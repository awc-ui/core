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
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.PlatformTextStyle
import androidx.compose.ui.unit.*
import kotlinx.coroutines.*
import kotlin.math.*

internal data class NativeIconButtonMetrics(val size: String, val density: Float, val buttonWidth: String) {
    private val index = listOf("xs","sm","md","lg","xl").indexOf(size).takeIf { it >= 0 } ?: 1
    private val rung = density.takeIf { it in -4f..0f && it == floor(it) } ?: 0f
    val height = max(32f,listOf(32f,40f,56f,96f,136f)[index]+rung*4)
    val width = max(32f,(when(buttonWidth) {
        "narrow" -> listOf(28f,32f,48f,64f,104f)
        "wide" -> listOf(40f,52f,72f,128f,184f)
        else -> listOf(32f,40f,56f,96f,136f)
    })[index]+rung*4)
    val icon = max(listOf(16f,18f,18f,24f,28f)[index],listOf(20f,24f,24f,32f,40f)[index]+rung*listOf(1f,1f,1f,2f,3f)[index])
    val round = listOf(16f,20f,28f,48f,68f)[index]
    val square = listOf(12f,12f,16f,28f,28f)[index]
    val pressed = listOf(8f,8f,12f,16f,16f)[index]
    val connected = listOf(4f,8f,8f,16f,20f)[index]
}
internal data class NativeIconButtonPalette(val container: String?, val icon: String, val outline: String?) {
    companion object {
        fun resolve(variant: String, toggle: Boolean, selected: Boolean) = when(variant) {
            "filled" -> if(toggle && !selected) NativeIconButtonPalette("surface-container-highest","primary",null)
                else NativeIconButtonPalette("primary","on-primary",null)
            "tonal" -> if(toggle && !selected) NativeIconButtonPalette("surface-container-highest","on-surface-variant",null)
                else NativeIconButtonPalette("secondary-container","on-secondary-container",null)
            "outlined" -> if(selected) NativeIconButtonPalette("inverse-surface","inverse-on-surface",null)
                else NativeIconButtonPalette(null,"on-surface-variant","outline")
            else -> NativeIconButtonPalette(null,if(selected) "primary" else "on-surface-variant",null)
        }
    }
}

/** Unlike md-button, the source icon button commits navigation/selection before notification. */
internal fun performNativeIconButtonAction(
    p: Props, selected: Boolean, emit: EventSink, action: AWCActionDispatcher?, router: AWCURLRouter,
    targetID: String, listeners: List<(AWCActionEvent)->Unit>, activation: AWCActivationMetadata,
    commit: (Boolean)->Unit,
): Boolean {
    if(!p.enabled()) return false
    AWCNavigationRequest.from(p.str("href"),p.str("target","_self"))?.let(router::open)
    val next = if(p.bool("toggle")) !selected else selected
    if(p.bool("toggle")) commit(next)
    val detail = eventDetail("selected" to next)
    dispatchNativeAction(AWCActionEvent("mdClick","md-icon-button",detail,targetID=targetID,activation=activation),action,listeners)
    emit("mdClick",detail)
    return true
}

internal val LocalAWCIconButtonSlot = staticCompositionLocalOf { false }
private val IconStandard = CubicBezierEasing(.2f,0f,0f,1f)
private val IconRelease = CubicBezierEasing(.05f,.7f,.1f,1f)
private data class IconWave(val press: PressInteraction.Press, val start: Long?=null, val end: Long?=null, val released: Boolean=false)

@Composable internal fun NativeIconButton(source: Props, emit: EventSink, slot: Slot?) {
    var ownSelected by awcState(source["selected"]) { source.bool("selected") }
    val groups = LocalButtonGroupAncestors.current
    val group = groups.lastOrNull()
    val identity = LocalButtonGroupChild.current?.id ?: remember { Any() }
    groups.forEach { it.register(identity,source.str("value"),ownSelected) }
    val direct=group?.directChildren?.contains(identity)==true
    val connectedGroup = group?.props?.str("variant")=="connected"
    val syncOwner=groups.maxByOrNull { it.syncRevision }
    val p = if(syncOwner==null) source else source + mapOf(
        "toggle" to true, "size" to syncOwner.props.str("size","sm"), "shape" to syncOwner.props.str("shape","round"),
        "density" to (source.num("density").takeIf { it < 0 } ?: group!!.props.num("density")),
        "connectedLeft" to (syncOwner.props.str("variant")=="connected" && syncOwner.indices.indexOf(identity)>0), "connectedRight" to (syncOwner.props.str("variant")=="connected" && syncOwner.indices.indexOf(identity)<syncOwner.indices.lastIndex))
    val selected = group?.states?.get(identity) ?: ownSelected
    groups.forEach { member -> DisposableEffect(member,identity) { onDispose { member.remove(identity) } } }
    SideEffect { if(group!=null) ownSelected=selected }
    LaunchedEffect(source["selected"]) { if(group!=null) group.states[identity]=source.bool("selected") }
    val appearance = LocalAWCIconButtonAppearance.current
    val metrics = NativeIconButtonMetrics(p.str("size","sm"),p.num("density"),p.str("buttonWidth","default"))
    val enabled = p.enabled()
    // Selected palette selectors explicitly exclude disabled source hosts.
    // Selected shape morphing does not, so retain selected for the geometry below.
    val palette = NativeIconButtonPalette.resolve(p.str("variant","standard"),p.bool("toggle"),selected && enabled)
    val actions = LocalAWCAction.current
    val target = LocalAWCActionTarget.current
    val targetID = remember { java.util.UUID.randomUUID().toString() }
    val anchor=LocalNativeAnchor.current
    val uri = LocalUriHandler.current
    val router = LocalAWCURLRouter.current ?: remember(uri) { AWCURLRouter { request ->
        if(!java.net.URI(request.url).isAbsolute) false else runCatching { uri.openUri(request.url);true }.getOrDefault(false)
    } }
    fun activate(metadata: AWCActivationMetadata) {
        if(anchor?.activate(metadata)==true) return
        performNativeIconButtonAction(p,selected,emit,actions,router,target?.id ?: targetID,
                target?.listeners?.invoke().orEmpty(),metadata) {
                ownSelected=it; if(group!=null) group.states[identity]=it
            }
        if(!p.bool("disabled") && group!=null) {
            groups.asReversed().forEach { it.reconcileButtonClick(identity,activation=metadata) }; ownSelected=group.states[identity]==true
        }
    }
    val interactions=remember { MutableInteractionSource() }
    val pointerPressed by interactions.collectIsPressedAsState()
    val hovered by interactions.collectIsHoveredAsState()
    var keyboardPressed by remember { mutableStateOf(false) }
    var pointer by remember { mutableStateOf<AWCActivationMetadata?>(null) }
    val focus=nativeButtonFocusModifier(p,identity,group?.focus,selected,groups.map { it.focus })
    val focused=focus.isFocusVisible
    val pressed=enabled && (pointerPressed || keyboardPressed)
    val reduced=!ValueAnimator.areAnimatorsEnabled()
    val keyboardScope=rememberCoroutineScope()
    var keyboardJob by remember { mutableStateOf<Job?>(null) }
    DisposableEffect(enabled) { onDispose { keyboardJob?.cancel();keyboardPressed=false } }
    val waves=remember { mutableStateListOf<IconWave>() }
    var now by remember { mutableLongStateOf(0) }
    LaunchedEffect(interactions,enabled,p.bool("ripple",true),reduced) {
        if(!enabled || !p.bool("ripple",true)) waves.clear()
        var frames:Job?=null
        interactions.interactions.collect { event ->
            if(enabled && p.bool("ripple",true)) {
                when(event) {
                    is PressInteraction.Press -> { waves+=IconWave(event);if(waves.size>4) waves.removeAt(0) }
                    is PressInteraction.Release -> { val i=waves.indexOfFirst { it.press==event.press };if(i>=0) waves[i]=waves[i].copy(released=true) }
                    is PressInteraction.Cancel -> { val i=waves.indexOfFirst { it.press==event.press };if(i>=0) waves[i]=waves[i].copy(released=true) }
                }
                if(frames?.isActive!=true && waves.isNotEmpty()) frames=launch(start=CoroutineStart.UNDISPATCHED) {
                    while(isActive && waves.isNotEmpty()) {
                        now=withFrameNanos { it }
                        waves.indices.forEach { i -> val wave=waves[i];waves[i]=wave.copy(start=wave.start ?: now,end=if(wave.released) wave.end ?: now else null) }
                        waves.removeAll { it.end?.let { end -> reduced || now>max((it.start ?: now)+450_000_000L,end)+150_000_000L } ?: false }
                    }
                }
            }
        }
    }
    val morph=p.bool("shapeMorph",true)
    val resting=appearance.cornerRadius?.toFloat() ?: if(p.str("shape")=="square") metrics.square else metrics.round
    // Source morph targets override a fixed resting radius, unlike md-button's hook.
    val targetRadius=if(morph && pressed) metrics.pressed else if(morph && selected) {
        if(p.str("shape")=="square") metrics.round else metrics.square
    } else resting
    val pressDuration=if(p.str("buttonWidth")=="narrow") 250 else 200
    val radius by animateFloatAsState(targetRadius,tween(if(reduced) 0 else if(pressed && morph) pressDuration else 400,
        easing=if(pressed) IconStandard else IconRelease),label="icon button corners")
    val connected=p.bool("connectedLeft") || p.bool("connectedRight")
    val fallbackStart=if(connected) { if(p.bool("connectedLeft") || p.str("shape")=="square") metrics.connected else metrics.round } else radius
    val fallbackEnd=if(connected) { if(p.bool("connectedRight") || p.str("shape")=="square") metrics.connected else metrics.round } else radius
    val groupCorners=if(direct && connectedGroup && connected) buttonGroupCorners(group!!.props.str("size","sm"),group.props.str("shape")=="square",true,p.bool("connectedLeft"),p.bool("connectedRight"),selected,pressed) else null
    val groupStart by animateFloatAsState(groupCorners?.first ?: fallbackStart,tween(if(reduced) 0 else if(pressed && morph) pressDuration else 400,easing=if(pressed) IconStandard else IconRelease),label="group icon start corners")
    val groupEnd by animateFloatAsState(groupCorners?.second ?: fallbackEnd,tween(if(reduced) 0 else if(pressed && morph) pressDuration else 400,easing=if(pressed) IconStandard else IconRelease),label="group icon end corners")
    val start=if(groupCorners!=null) groupStart else fallbackStart
    val end=if(groupCorners!=null) groupEnd else fallbackEnd
    val shape=RoundedCornerShape(start.dp,end.dp,end.dp,start.dp)
    val colors=MaterialTheme.colorScheme
    fun role(name:String?)=when(name) {
        "primary"->colors.primary;"on-primary"->colors.onPrimary;"secondary-container"->colors.secondaryContainer
        "on-secondary-container"->colors.onSecondaryContainer;"surface-container-highest"->colors.surfaceContainerHighest
        "inverse-surface"->colors.inverseSurface;"inverse-on-surface"->colors.inverseOnSurface
        "outline"->colors.outline;"on-surface"->colors.onSurface;"on-surface-variant"->colors.onSurfaceVariant;else->Color.Transparent
    }
    fun color(value:String?,fallback:Color)=value?.let(::statusDotColor) ?: fallback
    val disabledFilled=!enabled && p.str("variant") in listOf("filled","tonal")
    val colorTime=if(reduced) 0 else if(pressed && morph) pressDuration else 100
    val container by animateColorAsState(if(disabledFilled) colors.onSurface.copy(alpha=.12f) else color(appearance.containerColor,role(palette.container)),
        tween(colorTime,easing=IconStandard),label="icon button container")
    val icon by animateColorAsState(if(!enabled) colors.onSurface.copy(alpha=.38f) else color(appearance.iconColor,role(palette.icon)),
        tween(colorTime,easing=IconStandard),label="icon button icon")
    val state=color(appearance.stateLayerColor,role(palette.icon))
    val opacity by animateFloatAsState(if(!enabled) 0f else if(focused) .12f else if(pressed) .12f else if(hovered) .08f else 0f,
        tween(if(reduced) 0 else 100,easing=IconStandard),label="icon button state")
    val borderWidth=if(p.str("variant")=="outlined") appearance.outlineWidth?.toFloat() ?: 1f else 0f
    val outline=if(!enabled) colors.onSurface.copy(alpha=.12f) else if(selected) Color.Transparent else color(appearance.outlineColor,colors.outline)
    val connectedFloor=if(direct && connectedGroup && group!!.props.str("size") in listOf("xs","sm")) 48f else 0f
    val width=max(connectedFloor,max((appearance.width?.toFloat() ?: metrics.width)+2*(groups.firstNotNullOfOrNull { it.motionOffsets[identity] } ?: 0f),borderWidth*2))
    val height=max(appearance.height?.toFloat() ?: metrics.height,borderWidth*2)
    val iconSize=appearance.iconSize?.toFloat() ?: metrics.icon
    val inspection=LocalAWCInspection.current
    val direction=if(LocalLayoutDirection.current==LayoutDirection.Rtl) "rtl" else "ltr"
    val density=LocalDensity.current.density
    var hasBadge by remember { mutableStateOf(false) }
    val rootMetrics=AWCInspectionMetrics(padding=AWCInspectionInsets(),margin=AWCInspectionInsets(),
        border=AWCInspectionInsets(borderWidth.toDouble(),borderWidth.toDouble(),borderWidth.toDouble(),borderWidth.toDouble()),
        gap=AWCInspectionGap(0.0,0.0),display="Box",direction=direction)
    val label=p.str("aria-label",p.str("label"))
    val groupAppearance=if(direct) LocalAWCButtonGroupAppearance.current else null
    if(direct) group!!.childSizing[identity]=ButtonGroupSizing(connectedFloor,borderWidth*2,0f,height.coerceAtMost(groupAppearance?.maxHeight?.toFloat() ?: Float.POSITIVE_INFINITY))
    val dimensions=if(!direct) Modifier.requiredSize(width.dp,height.dp) else Modifier.widthIn(min=connectedFloor.dp).width(width.dp).height(height.coerceAtMost(groupAppearance?.maxHeight?.toFloat() ?: Float.POSITIVE_INFINITY).dp)
    Box(dimensions.inspectAWCNode(inspection,"","md-icon-button",rootMetrics)
        .zIndex(if(focused) 1f else 0f)
        .drawBehind {
            if(focused && !p.bool("disabled")) {
                val offset=3.5.dp.toPx()
                val ring=RoundedCornerShape((start+3.5f).dp,(end+3.5f).dp,(end+3.5f).dp,(start+3.5f).dp)
                    .createOutline(Size(size.width+offset*2,size.height+offset*2),layoutDirection,this)
                translate(-offset,-offset) { drawOutline(ring,colors.secondary,style=Stroke(3.dp.toPx())) }
            }
        }
        .then(if(hasBadge) Modifier else Modifier.clip(shape))
        .background(container,shape)
        .drawWithContent {
            // Source absolute inset:0 overlays use the host padding box,
            // excluding its border. Both overlays inherit the host's radius.
            val inset=borderWidth.dp.toPx()
            val inner=Size(max(0f,size.width-inset*2),max(0f,size.height-inset*2))
            val path=Path().apply { addOutline(shape.createOutline(inner,layoutDirection,this@drawWithContent)) }
            translate(inset,inset) {
                clipPath(path) {
                    drawRect(state.copy(alpha=state.alpha*opacity),size=inner)
                    waves.forEach { wave ->
                        val elapsed=max(0f,(now-(wave.start ?: now))/1_000_000f)
                        val origin=wave.press.pressPosition.takeIf { it.x.isFinite() && it.y.isFinite() } ?: center
                        val r=hypot(max(origin.x,size.width-origin.x),max(origin.y,size.height-origin.y))
                        val growth=if(reduced) 1f else IconStandard.transform((elapsed/450f).coerceIn(0f,1f))
                        val fade=wave.end?.let { max(450f,(it-(wave.start ?: now))/1_000_000f) } ?: Float.POSITIVE_INFINITY
                        val alpha=if(reduced) { if(wave.end==null) .12f else 0f } else .12f*(1-IconStandard.transform(((elapsed-fade)/150f).coerceIn(0f,1f)))
                        // md-ripple inherits currentColor, independently of state-layer ink.
                        drawCircle(icon.copy(alpha=icon.alpha*alpha),r*growth,origin)
                    }
                }
            }
            drawContent()
        }
        .then(if(borderWidth>0) Modifier.border(borderWidth.dp,outline,shape) else Modifier)
        .then(if(groups.isEmpty()) Modifier else Modifier.buttonGroupTree(child=identity)).then(focus.modifier)
        .pointerInput(density) {
            awaitEachGesture {
                val down=awaitFirstDown(false,PointerEventPass.Initial)
                pointer=AWCActivationMetadata("pointer",down.position.x/density,down.position.y/density)
                if(!p.bool("disabled")) groups.asReversed().forEach { it.startMotion(identity) }
                do { val event=awaitPointerEvent(PointerEventPass.Final) } while(event.changes.any { it.pressed })
                pointer=null
            }
        }
        .onPreviewKeyEvent { event ->
            if(event.key !in listOf(Key.Enter,Key.NumPadEnter,Key.Spacebar)) false else {
                if(event.type==KeyEventType.KeyDown && !p.bool("disabled")) groups.asReversed().forEach { it.startMotion(identity) }
                if(event.type==KeyEventType.KeyDown && enabled) {
                    keyboardPressed=true;keyboardJob?.cancel()
                    keyboardJob=keyboardScope.launch(start=CoroutineStart.UNDISPATCHED) {
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
        .clickable(interactionSource=interactions,indication=null,enabled=!p.bool("disabled"),role=Role.Button) {
            activate(pointer ?: AWCActivationMetadata("accessibility"))
        }
        .semantics {
            if(!enabled) disabled()
            if(p.bool("toggle")) this.selected=selected
            if(label.isNotEmpty()) contentDescription=label
        },contentAlignment=Alignment.Center) {
        Box(Modifier.matchParentSize().padding(borderWidth.dp).inspectAWCNode(inspection,"state-layer","State layer",
            AWCInspectionMetrics(display="Overlay",padding=AWCInspectionInsets(),margin=AWCInspectionInsets(),border=AWCInspectionInsets(),gap=AWCInspectionGap(0.0,0.0))))
        CompositionLocalProvider(LocalContentColor provides icon,LocalAWCButtonSlotSize provides iconSize.dp,
            LocalAWCIconButtonSlot provides true) {
            val fontSize=with(LocalDensity.current) { iconSize.dp.toSp() }
            ProvideTextStyle(TextStyle(fontSize=fontSize,lineHeight=fontSize,platformStyle=PlatformTextStyle(includeFontPadding=false))) {
                IconButtonSlots(iconSize.dp,p.bool("toggle"),selected,p.str("icon"),p.str("selectedIcon"),slot,LocalAWCSlots.current) { hasBadge=it }
            }
        }
    }
}

/** Inspect real slot layout, preserving the source badge/ avatar sizing exemptions. */
@Composable private fun IconButtonSlots(size:Dp,toggle:Boolean,selected:Boolean,icon:String,selectedIcon:String,slot:Slot?,
    registry:AWCSlotRegistry?,onBadge:(Boolean)->Unit) {
    val inspection=LocalAWCInspection.current
    val forwarded=LocalAWCForwardedIconInspection.current
    val forwardedAppearance=LocalAWCForwardedIconAppearance.current
    // One subcomposition per slot permits presence checks without inventing placeholder content.
    SubcomposeLayout { _ ->
        val px=size.roundToPx().coerceAtLeast(0)
        val decoratedWidth=px+(((forwardedAppearance?.borderWidth ?: 0.0)*2+(forwardedAppearance?.paddingInlineStart ?: 0.0))*density).roundToInt()
        val decoratedHeight=px+((forwardedAppearance?.borderWidth ?: 0.0)*2*density).roundToInt()
        fun content(name:String):List<Measurable> = subcompose("slot-$name") {
            CompositionLocalProvider(LocalAWCButtonSlotPart provides if(name=="selected") "selected-icon" else "icon") {
                if(registry?.contains(name)==true) registry.Render(name) else slot?.invoke(name)
            }
        }
        val defaults=content("")
        val alternates=if(toggle) content("selected") else emptyList()
        val meaningfulDefault=defaults.any { it.layoutId !is NativeBadgePlacement }
        val meaningfulSelected=alternates.any { it.layoutId !is NativeBadgePlacement }
        val showSelected=toggle && selected && (selectedIcon.isNotEmpty() || meaningfulSelected)
        val chosen=if(showSelected) alternates else defaults
        val part=if(showSelected) "selected-icon" else "icon"
        val badge=defaults.any { it.layoutId is NativeBadgePlacement }
        onBadge(badge)
        val glyph=if(showSelected) { if(!meaningfulSelected) selectedIcon else "" } else if(!meaningfulDefault) icon else ""
        val placeables=chosen.map { measurable ->
            val preserve=measurable.layoutId is NativeBadgePlacement || measurable.layoutId == "awc-icon-avatar"
            measurable.layoutId to measurable.measure(if(preserve) Constraints() else Constraints.fixed(px,px))
        }
        val fallback=if(glyph.isNotEmpty()) subcompose("fallback") {
            CompositionLocalProvider(LocalAWCButtonSlotPart provides part) {
                val decoration=forwardedAppearance ?: AWCSnackbarPartAppearance()
                Box(Modifier.snackbarPartPaint(decoration).padding(start=(decoration.paddingInlineStart ?: 0.0).dp),contentAlignment=Alignment.Center) { AWCMaterialSymbol(glyph) }
            }
        }.map { it.measure(Constraints.fixed(decoratedWidth,decoratedHeight)) } else emptyList()
        // This small layout node owns the visible icon part, including authored children.
        val marker=subcompose("inspection-$part") {
            Box(Modifier.inspectAWCNode(inspection,part,if(showSelected) "Selected icon" else "Icon",
                AWCInspectionMetrics(display="Slot",padding=AWCInspectionInsets(),margin=AWCInspectionInsets(),border=AWCInspectionInsets(),gap=AWCInspectionGap(0.0,0.0)))
                .then(if(forwarded!=null && !showSelected) Modifier.inspectAWCNode(forwarded.first,forwarded.second,"Close icon",
                    AWCInspectionMetrics(display="Slot",padding=AWCInspectionInsets(),margin=AWCInspectionInsets(),border=AWCInspectionInsets(),gap=AWCInspectionGap(0.0,0.0))) else Modifier))
        }.map { it.measure(Constraints.fixed(decoratedWidth,decoratedHeight)) }
        val forwardedMargin=((forwardedAppearance?.marginInlineStart ?: 0.0)*density).roundToInt()
        layout((decoratedWidth+forwardedMargin).coerceAtLeast(0),decoratedHeight) {
            marker.forEach { it.placeRelative(forwardedMargin,0) }
            fallback.forEach { it.placeRelative(forwardedMargin,0) }
            var x=(px-placeables.filter { it.first !is NativeBadgePlacement }.sumOf { it.second.width })/2
            placeables.forEach { (kind,child) ->
                if(kind is NativeBadgePlacement) {
                    val offset = kind.position(px, px, child.width, child.height, density)
                    child.place(offset.x, offset.y)
                }
                else { child.placeRelative(x,(px-child.height)/2); x+=child.width }
            }
        }
    }
}
