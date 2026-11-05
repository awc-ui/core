package dev.awc.nativeui

import android.animation.ValueAnimator
import androidx.compose.animation.core.*
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.*
import androidx.compose.ui.unit.*
import kotlinx.coroutines.*
import kotlin.math.roundToInt

internal val LocalFabMenuInspection = staticCompositionLocalOf<AWCInspectionContext?> { null }

@Composable
internal fun NativeFabMenu(p: Props,emit: EventSink,slot: Slot?) {
    // Without an AWCFabMenuScope there is no anchor to attach to: like the SwiftUI renderer, the menu stays an inert,
    // zero-size placeholder instead of failing composition (a generic AWCComponent tree may contain it).
    val registry=LocalNativeAnchorRegistry.current ?: run {
        LaunchedEffect(Unit) { android.util.Log.w("AWCFabMenu","md-fab-menu needs AWCFabMenuScope around it and its anchor; rendering nothing.") }
        return
    }
    val scope=rememberCoroutineScope()
    val state=remember { NativeFabMenuState(p.bool("open"),scope) }
    val controller=LocalAWCFabMenuController.current
    val identity=remember { Any() }
    val actions=LocalAWCAction.current
    val actionTarget=LocalAWCActionTarget.current
    val targetID=remember { java.util.UUID.randomUUID().toString() }
    val inspection=LocalAWCInspection.current
    val locals=currentCompositionLocalContext
    val anchor=registry.anchors[p.str("anchor")]
    var openingFocus by remember { mutableStateOf(false) }
    var keyboardModality by remember { mutableStateOf(false) }
    val latestEmit=rememberUpdatedState(emit)
    fun resolvePlacement() {
        registry.refresh()
        state.effectivePlacement=when(p.str("placement","up")) {
            "auto"->if(anchor==null || anchor.bounds.top-registry.bounds.top>registry.bounds.bottom-anchor.bounds.bottom) "up" else "down"
            "down"->"down"
            else->"up"
        }
    }
    SideEffect {
        state.props=p;state.quick=p.bool("quick")
        state.onOpenCommit={ open ->
            if(open) resolvePlacement()
            val name=if(open) "mdOpen" else "mdClose"
            val event=AWCActionEvent(name,"md-fab-menu",emptyMap(),targetID=actionTarget?.id ?: targetID)
            dispatchNativeAction(event,actions,actionTarget?.listeners?.invoke().orEmpty())
            latestEmit.value(name,null)
        }
        state.onOpeningFocus={ openingFocus.also { openingFocus=false } }
        state.onAnchorFocus={
            if(keyboardModality) anchor?.focus?.requestFocus() else anchor?.focus?.requestPointerFocus()
        }
    }
    val latestPlacement=rememberUpdatedState { resolvePlacement() }
    DisposableEffect(controller,state,identity) {
        controller?.attach(identity,state)
        onDispose { controller?.detach(identity) }
    }
    DisposableEffect(state) { onDispose { state.disconnect() } }
    LaunchedEffect(state) {
        state.loaded()
        if(state.open) latestPlacement.value()
    }
    LaunchedEffect(p.bool("open")) { state.updateOpen(p.bool("open")) }
    LaunchedEffect(p.str("placement","up")) {
        if(p.str("placement","up")!="auto") state.effectivePlacement=p.str("placement","up")
    }
    DisposableEffect(anchor,state) {
        anchor?.activateMenu={ metadata,wasFocused ->
            keyboardModality=metadata.source!="pointer"
            openingFocus=keyboardModality || wasFocused
            if(state.open || state.closing) state.close() else scope.launch { state.show() }
        }
        anchor?.menuKey={ key,shift ->
            if(key.isNotEmpty()) keyboardModality=true
            state.anchorKey(key,shift)
        }
        onDispose {
            anchor?.activateMenu=null;anchor?.menuKey=null
            anchor?.expanded=null;anchor?.fabPresentation=null;anchor?.setMenuIcon?.invoke(null)
        }
    }
    // The source swaps the glyph halfway through a 120 ms fade-out/fade-in
    // sequence. Cancelled/reversed transitions never overwrite the next state.
    LaunchedEffect(anchor,state.open) {
        if(anchor!=null) {
            anchor.expanded=state.open
            val variant=p.str("variant","primary")
            if(state.open) {
                anchor.fabPresentation=NativeFabAnchorPresentation(variant,circle=true,fading=true)
                delay(120)
                if(state.open) {
                    anchor.setMenuIcon?.invoke("close")
                    anchor.fabPresentation=NativeFabAnchorPresentation(variant,circle=true,fading=false)
                }
            } else if(anchor.fabPresentation!=null) {
                anchor.fabPresentation=NativeFabAnchorPresentation(variant,circle=false,fading=true)
                delay(120)
                if(!state.open) { anchor.setMenuIcon?.invoke(null);anchor.fabPresentation=null }
            }
        }
    }
    val layerContent=rememberUpdatedState<@Composable ()->Unit> {
        CompositionLocalProvider(locals) {
            CompositionLocalProvider(LocalNativeFabMenu provides state,LocalNativeAnchor provides null,
                LocalFabMenuInspection provides if(state.open && !p.bool("hidden")) inspection else null,
                LocalAWCInspection provides null,LocalAWCFabMenuController provides null,LocalAWCActionTarget provides null) {
                NativeFabMenuLayer(state,registry,anchor,inspection,p,slot)
            }
        }
    }
    val entry=remember(state) { NativeFabMenuLayerEntry(state,layerContent) }
    DisposableEffect(registry,entry) {
        registry.menus+=entry
        onDispose { registry.menus.remove(entry) }
    }
    // Like the source fixed-position host, the authored menu has no flow size.
    Spacer(Modifier.size(0.dp))
}

@Composable
private fun NativeFabMenuLayer(state: NativeFabMenuState,registry: NativeAnchorRegistry,anchor: NativeAnchor?,
    inspection: AWCInspectionContext?,p: Props,slot: Slot?) {
    val visible=state.open && !p.bool("hidden")
    val reduced=!ValueAnimator.areAnimatorsEnabled()
    val progress=remember { Animatable(if(visible) 0f else 0f) }
    LaunchedEffect(visible,state.closing) {
        if(!visible) progress.snapTo(0f)
        else if(reduced) progress.snapTo(1f)
        else progress.animateTo(if(state.closing) 0f else 1f,
            tween(150,easing=if(state.closing) CubicBezierEasing(.3f,0f,.8f,.15f) else CubicBezierEasing(.05f,.7f,.1f,1f)))
    }
    val rtl=LocalLayoutDirection.current==LayoutDirection.Rtl
    val appearance=LocalAWCFabMenuAppearance.current
    val gap=appearance.itemGap?.toFloat() ?: if(p.int("density")==-4) 2f else 4f
    val slots=LocalAWCSlots.current
    val direction=if(rtl) "rtl" else "ltr"
    // Measure the scope separately from the item stack: source host is fixed,
    // inset 0; only the stack takes pointer input and an accessible menu name.
    Layout(modifier=Modifier.fillMaxSize().then(if(visible) Modifier.inspectAWCNode(inspection,"","md-fab-menu overlay",
        AWCInspectionMetrics(display="Overlay",direction=direction)) else Modifier.clearAndSetSemantics { }),
        content={
            Layout(modifier=Modifier
                .fabMenuTree(menu=state)
                .onGloballyPositioned { state.coordinates=it }
                .graphicsLayer {
                    alpha=if(reduced && visible) 1f else progress.value
                    scaleY=if(reduced && visible) 1f else .8f+.2f*progress.value
                    transformOrigin=TransformOrigin(1f,if(state.effectivePlacement=="up") 1f else 0f)
                }
                .then(if(visible) Modifier.semantics {
                    paneTitle=p.str("menuLabel","Actions")
                    isTraversalGroup=true
                    collectionInfo=CollectionInfo(state.items.size,1)
                } else Modifier.clearAndSetSemantics { }),
                content={ if(slots?.contains("")==true) slots.Render("") else slot?.invoke("") }) { measurables,_ ->
                val children=measurables.map { it.measure(Constraints()) }
                val spacing=gap.dp.roundToPx()
                val width=children.maxOfOrNull { it.width } ?: 0
                val height=children.sumOf { it.height }+spacing*(children.size-1).coerceAtLeast(0)
                layout(width,height) {
                    var y=0
                    val visual=if(state.effectivePlacement=="up") children.asReversed() else children
                    visual.forEach { child ->
                        child.placeRelative(width-child.width,y)
                        y+=child.height+spacing
                    }
                }
            }
        }) { children,constraints ->
        val stack=children.single().measure(Constraints())
        val width=constraints.maxWidth.takeUnless { it==Constraints.Infinity } ?: 0
        val height=constraints.maxHeight.takeUnless { it==Constraints.Infinity } ?: 0
        // Resolve the anchor live from the registry: the layer lambda can hold the anchor captured before the anchor
        // registered (the Laboratory host composed the menu first and measured every item at the overlay origin).
        val rect=(registry.anchors[p.str("anchor")] ?: anchor)?.bounds
        val offsetX=if(rect==null) 0 else ((if(rtl) rect.left else rect.right-stack.width)-registry.bounds.left).roundToInt()
        val offsetY=if(rect==null) 0 else ((if(state.effectivePlacement=="up") rect.top-stack.height-8.dp.toPx() else rect.bottom+8.dp.toPx())-registry.bounds.top).roundToInt()
        layout(width,height) { if(visible) stack.place(offsetX,offsetY) }
    }
}
