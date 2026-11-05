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
import androidx.compose.ui.geometry.Size
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
import kotlinx.coroutines.Job
import kotlin.math.*

internal val LocalNativeFabMenu = staticCompositionLocalOf<NativeFabMenuState?> { null }
internal data class NativeFabMenuItemMetrics(val rung: Int) {
    val density=rung.coerceIn(-4,0)
    val height=max(32f,48f+4*density)
    val icon=max(16f,20f+density)
    val font=max(12f,14f+.5f*density)
    val line=max(16f,20f+density)
    val leading=when(density) { -4->8f;-3,-2->12f;else->16f }
    val trailing=when(density) { -4,-3->16f;-2->20f;else->24f }
    val gap=if(density<=-3) 4f else 8f
}
private val MenuItemEasing=CubicBezierEasing(.2f,0f,0f,1f)
private val MenuItemFont=FontFamily(Font(R.font.awc_roboto_medium,FontWeight.Medium))

@Composable
internal fun NativeFabMenuItem(source: Props,emit: EventSink,slot: Slot?) {
    if(source.bool("hidden")) return
    val menu=LocalNativeFabMenu.current
    val inherited=menu?.props?.int("density") ?: 0
    val rung=source.int("density").takeIf { it in -4..-1 } ?: inherited
    val metrics=NativeFabMenuItemMetrics(rung)
    val identity=remember { Any() }
    val index=menu?.items?.indexOfFirst { it.id===identity } ?: -1
    val tabIndex=if(menu!=null) { if(menu.open && menu.focusedIndex==index && index>=0) 0 else -1 }
        else source.int("tabindex",-1)
    val focus=nativeButtonFocusModifier(source,identity,null,false,allowDisabledFocus=true,tabIndexOverride=tabIndex)
    val labelRegistry=remember { AWCSlotTextRegistry() }
    val label=source.str("label")
    val searchName=rememberUpdatedState(label.trim().ifEmpty { labelRegistry.text })
    val entry=remember(identity,focus.state) { NativeFabMenuItemEntry(identity,focus.state) { searchName.value } }
    SideEffect { menu?.register(entry) }
    DisposableEffect(menu,identity) { onDispose { menu?.remove(identity) } }
    LaunchedEffect(focus.state.isFocused) { if(focus.state.isFocused) menu?.focused(identity) }
    val explicitFocus=source.bool("rovingFocusVisible") || (menu?.rovingFocus==true && menu.focusedIndex==index)
    val shownFocus=focus.isFocusVisible || (explicitFocus && !focus.state.isFocused)
    val enabled=source.enabled()
    val interactions=remember { MutableInteractionSource() }
    val pressed by interactions.collectIsPressedAsState()
    val hovered by interactions.collectIsHoveredAsState()
    val reduced=!ValueAnimator.areAnimatorsEnabled()
    val scope=rememberCoroutineScope()
    var keyRipple by remember { mutableStateOf<Job?>(null) }
    DisposableEffect(enabled) { onDispose { keyRipple?.cancel() } }
    var pointer by remember { mutableStateOf<AWCActivationMetadata?>(null) }
    val actions=LocalAWCAction.current
    val target=LocalAWCActionTarget.current
    val targetID=remember { java.util.UUID.randomUUID().toString() }
    fun activate(activation: AWCActivationMetadata) {
        if(!enabled) return
        val event=AWCActionEvent("mdClick","md-fab-menu-item",emptyMap(),targetID=target?.id ?: targetID,activation=activation)
        dispatchNativeAction(event,actions,target?.listeners?.invoke().orEmpty())
        emit("mdClick",null)
        if(!event.propagationStopped) menu?.itemActivated()
    }
    val colors=MaterialTheme.colorScheme
    val palette=when(menu?.props?.str("variant")) {
        "secondary"->colors.secondaryContainer to colors.onSecondaryContainer
        "tertiary"->colors.tertiaryContainer to colors.onTertiaryContainer
        else->colors.primaryContainer to colors.onPrimaryContainer
    }
    val parentAppearance=LocalAWCFabMenuAppearance.current
    val appearance=LocalAWCFabMenuItemAppearance.current
    fun color(value:String?,fallback:Color)=value?.let { Color(0xff000000L or it.drop(1).toLong(16)) } ?: fallback
    val container by animateColorAsState(if(enabled) color(appearance.containerColor,color(parentAppearance.itemContainerColor,palette.first)) else colors.onSurface.copy(alpha=.12f),
        tween(if(reduced) 0 else 280,easing=MenuItemEasing),label="FAB menu item background")
    val labelInk=if(enabled) color(appearance.labelColor,color(parentAppearance.itemLabelColor,palette.second)) else colors.onSurface.copy(alpha=.38f)
    val iconInk=color(appearance.iconColor,labelInk)
    val opacity by animateFloatAsState(
        if(source.bool("softDisabled")) 0f else if(shownFocus && (enabled || !focus.state.isFocused)) .12f
        else if(!enabled) 0f else if(pressed) .12f else if(hovered) .08f else 0f,
        tween(if(reduced) 0 else 280,easing=MenuItemEasing),label="FAB menu item state opacity")
    val radius=appearance.cornerRadius?.toFloat() ?: 9999f
    val shape=RoundedCornerShape(radius.dp)
    val iconSize=appearance.iconSize?.toFloat() ?: metrics.icon
    val density=LocalDensity.current
    val rtl=LocalLayoutDirection.current==LayoutDirection.Rtl
    val direction=if(rtl) "rtl" else "ltr"
    val inspection=LocalAWCInspection.current
    val slots=LocalAWCSlots.current
    val style=TextStyle(fontFamily=MenuItemFont,fontSize=metrics.font.sp,fontWeight=FontWeight.Medium,
        lineHeight=metrics.line.sp,letterSpacing=.1.sp,textMotion=TextMotion.Animated,platformStyle=PlatformTextStyle(includeFontPadding=false),
        lineHeightStyle=LineHeightStyle(LineHeightStyle.Alignment.Center,LineHeightStyle.Trim.None,LineHeightStyle.Mode.Fixed))
    val ripple=nativeSourceRipple(interactions,labelInk,enabled)
    SubcomposeLayout(Modifier
        .fabMenuTree(item=identity)
        .drawBehind {
            if(shownFocus) {
                val offset=3.5.dp.toPx()
                val outline=RoundedCornerShape((radius+3.5f).dp).createOutline(Size(size.width+offset*2,size.height+offset*2),layoutDirection,this)
                translate(-offset,-offset) { drawOutline(outline,colors.secondary,style=Stroke(3.dp.toPx())) }
            }
        }
        .clip(shape).background(container)
        .drawWithContent { drawRect(labelInk.copy(alpha=labelInk.alpha*opacity));drawContent() }
        .then(ripple).then(focus.modifier).hoverable(interactions)
        .pointerInput(density.density) {
            awaitEachGesture {
                val down=awaitFirstDown(false,PointerEventPass.Initial)
                pointer=AWCActivationMetadata("pointer",down.position.x/density.density,down.position.y/density.density)
                do { val event=awaitPointerEvent(PointerEventPass.Final) } while(event.changes.any { it.pressed })
                pointer=null
            }
        }
        .onPreviewKeyEvent { event ->
            if(event.type!=KeyEventType.KeyDown) event.key in listOf(Key.Enter,Key.NumPadEnter,Key.Spacebar)
            else if(event.key in listOf(Key.Enter,Key.NumPadEnter,Key.Spacebar)) {
                if(enabled) { keyRipple?.cancel();keyRipple=scope.nativeKeyboardRipple(interactions);activate(AWCActivationMetadata("keyboard")) }
                true
            } else menu?.itemKey(identity,event.fabMenuKey(),event.isShiftPressed) ?: false
        }
        .then(if(source.bool("disabled")) Modifier.focusable(interactionSource=interactions) else Modifier)
        .clickable(interactionSource=interactions,indication=null,enabled=!source.bool("disabled"),role=Role.Button) {
            activate(pointer ?: AWCActivationMetadata("accessibility"))
        }
        .semantics {
            if(!enabled) disabled()
            if(source.containsKey("aria-label")) contentDescription=source.str("aria-label")
            else if(label.isNotEmpty()) contentDescription=label
        }
    ) { _ ->
        val iconPx=iconSize.dp.roundToPx()
        val authored=subcompose("icon-slot") {
            CompositionLocalProvider(LocalContentColor provides iconInk,LocalAWCButtonSlotSize provides iconSize.dp,
                LocalAWCButtonSlotPart provides "icon") {
                ProvideTextStyle(style) { if(slots?.contains("icon")==true) slots.Render("icon") else slot?.invoke("icon") }
            }
        }.map { it.measure(Constraints.fixed(iconPx,iconPx)) }
        val icons=authored.ifEmpty {
            if(source.str("icon").isEmpty()) emptyList() else subcompose("fallback-icon") {
                CompositionLocalProvider(LocalContentColor provides iconInk,LocalAWCButtonSlotSize provides iconSize.dp,
                    LocalAWCButtonSlotPart provides "icon") { AWCMaterialSymbol(source.str("icon")) }
            }.map { it.measure(Constraints.fixed(iconPx,iconPx)) }
        }
        val authoredLabels=subcompose("authored-label") {
            Box(Modifier.inspectAWCNode(if(label.isEmpty()) inspection else null,"label","Label",AWCInspectionMetrics(
                typography=AWCInspectionTypography(metrics.font.toDouble(),metrics.line.toDouble(),500,.1,"Roboto"),
                display="Row",direction=direction))) {
                CompositionLocalProvider(LocalContentColor provides labelInk,LocalAWCSlotTextRegistry provides labelRegistry,
                    LocalAWCInspection provides if(label.isEmpty()) inspection else null) {
                    ProvideTextStyle(style) { if(slots?.contains("")==true) slots.Render("") else slot?.invoke("") }
                }
            }
        }.map { it.measure(Constraints()) }
        val labels=if(label.isEmpty()) authoredLabels else subcompose("label") {
            Box(Modifier.inspectAWCNode(inspection,"label","Label",AWCInspectionMetrics(
                typography=AWCInspectionTypography(metrics.font.toDouble(),metrics.line.toDouble(),500,.1,"Roboto"),
                display="Text",direction=direction))) {
                Text(label,color=labelInk,style=style,softWrap=false,maxLines=1,overflow=TextOverflow.Clip,modifier=Modifier.clearAndSetSemantics { })
            }
        }.map { it.measure(Constraints()) }
        val start=if(icons.isNotEmpty()) metrics.leading else metrics.trailing
        val gap=if(icons.isNotEmpty()) metrics.gap else 0f
        val startPx=start.dp.roundToPx();val endPx=metrics.trailing.dp.roundToPx();val gapPx=gap.dp.roundToPx()
        val iconWidth=icons.sumOf { it.width }
        val labelWidth=labels.maxOfOrNull { it.width } ?: 0
        val height=max(metrics.height.dp.roundToPx(),max(icons.maxOfOrNull { it.height } ?: 0,labels.maxOfOrNull { it.height } ?: 0))
        val width=startPx+iconWidth+gapPx+labelWidth+endPx
        val markers=subcompose("markers") {
            Box(Modifier.inspectAWCNode(inspection,"","md-fab-menu-item",AWCInspectionMetrics(
                padding=AWCInspectionInsets(0.0,if(rtl) start.toDouble() else metrics.trailing.toDouble(),0.0,if(rtl) metrics.trailing.toDouble() else start.toDouble()),
                border=AWCInspectionInsets(),margin=AWCInspectionInsets(),gap=AWCInspectionGap(0.0,metrics.gap.toDouble()),
                typography=AWCInspectionTypography(metrics.font.toDouble(),metrics.line.toDouble(),500,.1,"Roboto"),display="Row",direction=direction)))
            Box(Modifier.inspectAWCNode(inspection,"state-layer","State layer",AWCInspectionMetrics(display="Overlay",direction=direction)))
        }.map { it.measure(Constraints.fixed(width,height)) }
        val iconMarker=if(icons.isNotEmpty()) subcompose("icon-marker") {
            Box(Modifier.inspectAWCNode(inspection,"icon","Icon",AWCInspectionMetrics(display="Slot",direction=direction)))
        }.map { it.measure(Constraints.fixed(iconWidth,iconPx)) } else emptyList()
        layout(width,height) {
            markers.forEach { it.place(0,0) }
            var x=startPx
            iconMarker.forEach { it.placeRelative(x,(height-it.height)/2) }
            icons.forEach { it.placeRelative(x,(height-it.height)/2);x+=it.width }
            x+=gapPx
            labels.forEach { it.placeRelative(x,(height-it.height)/2) }
        }
    }
}
