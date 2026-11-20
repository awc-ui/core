package dev.awc.nativeui

import androidx.compose.ui.graphics.Color
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.layout.*
import androidx.compose.ui.node.ModifierNodeElement
import androidx.compose.ui.node.requireLayoutCoordinates
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.unit.*
import kotlinx.coroutines.launch
import kotlin.math.max
import kotlin.math.roundToInt

/** Native counterparts of the item's asynchronous toggle() and focusHeader() methods. */
@Stable class AWCAccordionItemController {
    internal var item:NativeAccordionItemState? by mutableStateOf(null)
    val isConnected:Boolean get()=item!=null
    val isExpanded:Boolean get()=item?.expanded ?: false
    /** Current (owner-controlled while owned) source `collapsible`, `disabled` and data-index values. */
    val isCollapsible:Boolean get()=item?.collapsible ?: true
    val isDisabled:Boolean get()=item?.disabled ?: false
    val index:Int get()=item?.index ?: -1
    /** Respects disabled and locked-open state, exactly like the source method. */
    fun toggle() { item?.toggle() }
    /** Moves keyboard focus (with a visible indicator) to the item's header. */
    fun focusHeader() { item?.focusHeader() }
}
internal val LocalAWCAccordionItemController=staticCompositionLocalOf<AWCAccordionItemController?> { null }
/** Attach a controller to the md-accordion-item composed directly inside [content]. */
@Composable fun AWCAccordionItemControllerScope(controller:AWCAccordionItemController,content:@Composable ()->Unit) {
    CompositionLocalProvider(LocalAWCAccordionItemController provides controller,content=content)
}

/** Parent data of one retained item root; identity survives reorder and collapse. */
internal class NativeAccordionChild(val state:NativeAccordionItemState) {
    val generatedTarget=java.util.UUID.randomUUID().toString()
    var targetID=generatedTarget
    /** Initial connection selects without an opening transition. */
    var snapNext=false
    var marker:AccordionChildMarkerNode?=null
    /**
     * Whether this item's root layout node is a direct child of [owner]'s layout node
     * (the source owns only direct children); null while either node is detached.
     */
    fun isDirectChildOf(owner:NativeAccordionOwner):Boolean? {
        val item=marker?.takeIf { it.isAttached } ?: return null
        val group=owner.marker?.takeIf { it.isAttached } ?: return null
        return item.requireLayoutCoordinates().parentLayoutCoordinates===group.requireLayoutCoordinates()
    }
}
/** Marks an item's root layout node. */
internal class AccordionChildMarkerNode(var child:NativeAccordionChild):Modifier.Node() {
    override fun onAttach() { child.marker=this }
    override fun onDetach() { if(child.marker===this) child.marker=null }
}
internal data class AccordionChildMarkerElement(val child:NativeAccordionChild):ModifierNodeElement<AccordionChildMarkerNode>() {
    override fun create()=AccordionChildMarkerNode(child)
    override fun update(node:AccordionChildMarkerNode) {
        if(node.child===child) return
        if(node.child.marker===node) node.child.marker=null
        node.child=child;if(node.isAttached) child.marker=node
    }
}
/**
 * Marks the group's layout node. It is the last element of the group's modifier
 * chain, so its coordinates are the inner coordinates that direct children report
 * as their parent layout coordinates.
 */
internal class AccordionGroupMarkerNode(var owner:NativeAccordionOwner):Modifier.Node() {
    override fun onAttach() { owner.marker=this }
    override fun onDetach() { if(owner.marker===this) owner.marker=null }
}
internal data class AccordionGroupMarkerElement(val owner:NativeAccordionOwner):ModifierNodeElement<AccordionGroupMarkerNode>() {
    override fun create()=AccordionGroupMarkerNode(owner)
    override fun update(node:AccordionGroupMarkerNode) {
        if(node.owner===owner) return
        if(node.owner.marker===node) node.owner.marker=null
        node.owner=owner;if(node.isAttached) owner.marker=node
    }
}
internal object AccordionPlaceholderID

internal class NativeAccordionOwner(val state:NativeAccordionState) {
    var inspection:AWCInspectionContext?=null
    var connected=false
    var initializing=false
    private val composed=mutableListOf<NativeAccordionChild>()
    var measured:List<NativeAccordionChild>?=null
    var authored:List<NativeAccordionChild> = emptyList()
    var revision by mutableIntStateOf(0)
    private val targets=mutableMapOf<String,NativeAccordionChild>()
    /** Sibling shift and drop-placeholder glide tracks (CSS transitions on the frame clock). */
    val motion=NativeAccordionReorderMotion()
    var frameMillis by mutableDoubleStateOf(0.0)
    var motionVersion by mutableIntStateOf(0)
    var shiftTiming=NativeAccordionReorderMotion.Timing(0.0,listOf(.2,0.0,0.0,1.0))
    var glideTiming=NativeAccordionReorderMotion.Timing(0.0,listOf(.2,0.0,0.0,1.0))
    /** Floating panel elevation: 0 = resting, 1 = dragging (box-shadow on the effects transition). */
    val panelElevation=AWCCSSValueTrack(0.0,accordionLerp)
    var panelTiming=NativeAccordionReorderMotion.Timing(0.0,listOf(.34,.8,.34,1.0))
    var scope:kotlinx.coroutines.CoroutineScope?=null
    private var motionJob:kotlinx.coroutines.Job?=null
    private var motionPending=false
    /**
     * Requests a style change for the reorder transforms. The frame awaiter is registered
     * synchronously (an input handler runs before the frame's animation callbacks), so the
     * change applies at the frame time of the frame that first renders it, like a CSS style
     * change. The loop keeps ticking only while a transition runs.
     */
    fun requestMotion() {
        motionPending=true
        if(motionJob?.isActive==true) return
        val scope=scope ?: return
        motionJob=scope.launch(start=kotlinx.coroutines.CoroutineStart.UNDISPATCHED) {
            while(true) {
                withFrameNanos { t->
                    val now=t/1_000_000.0
                    frameMillis=now
                    if(motionPending) { motionPending=false;applyMotion(now) }
                }
                if(!motionPending && !motion.running(frameMillis) && !panelElevation.isRunning(frameMillis)) break
            }
        }
    }
    private fun applyMotion(now:Double) {
        panelElevation.set(if(state.chassisDragging) 1.0 else 0.0,now,panelTiming.duration,panelTiming.curve)
        motion.update(state.draggedItemID,state.items.map { it.id },state.siblingOffsets,state.dropPlaceholder?.top,shiftTiming,glideTiming,now)
        motionVersion++
    }
    /** Drop and cancellation clear every transform in the same tick. */
    fun endMotion() { motionPending=false;motion.clear();motionVersion++ }
    /** Read-only view of the reorder motion for inspection and tests. */
    val reorderInspection=AWCAccordionReorderInspection(this)
    val itemBounds=mutableMapOf<String,Rect>()
    var rootBounds:Rect?=null
    var density=1f
    var marker:AccordionGroupMarkerNode?=null
    /** Called during the child's composition, in composition order (no snapshot writes). */
    fun register(child:NativeAccordionChild) { if(composed.none { it===child }) composed+=child;retarget(child) }
    fun retarget(child:NativeAccordionChild) {
        if(targets[child.targetID]===child) return
        targets.entries.removeAll { it.value===child };targets[child.targetID]=child
    }
    fun unregister(child:NativeAccordionChild) {
        composed.removeAll { it===child };targets.entries.removeAll { it.value===child };itemBounds.remove(child.state.id);revision++
    }
    /**
     * Direct members in authored order: the actual layout children once measured.
     * Before the first measure (the connection frame) composed registrations are
     * filtered by their attached layout parent, so an item wrapped in another
     * layout is never owned, not even provisionally.
     */
    fun direct():List<NativeAccordionChild> = measured?.filter { m -> composed.any { it===m } }
        ?: composed.filter { it.isDirectChildOf(this)!=false }
    /** The owner listener runs during the bubble phase at the parent's scope. */
    fun receive(event:AWCActionEvent) {
        if(event.tag!="md-accordion-item") return
        val item=targets[event.targetID]?.state ?: return
        val d=event.detail
        fun index()=(d["index"] as? Number ?: d["from"] as? Number)?.toInt() ?: -1
        when(event.name) {
            "mdItemToggle"->state.itemToggled(item,d["expanded"] as? Boolean ?: item.expanded,index())
            "mdItemRequestFocus"->state.navigate(item,d["direction"] as? String ?: return,index())
            "mdItemRequestReorder"->state.keyboardReorder(item,d["direction"] as? String ?: return,index())
        }
    }
}
internal val LocalNativeAccordionOwner=staticCompositionLocalOf<NativeAccordionOwner?> { null }
/** Registers a composed child immediately and releases it when it leaves (or never enters) the composition. */
internal class NativeAccordionRegistration(private val owner:NativeAccordionOwner?,private val child:NativeAccordionChild):RememberObserver {
    init { owner?.register(child) }
    override fun onRemembered() {}
    override fun onForgotten() { owner?.unregister(child) }
    override fun onAbandoned() { owner?.unregister(child) }
}

internal fun accordionConfiguration(p:Props)=NativeAccordionConfiguration(
    variant=if(p.str("variant","filled")=="outlined") "outlined" else "filled",density=p.num("density").toDouble(),
    elevation=p.int("elevation"),reorderable=p.bool("reorderable"),floating=p.bool("floating"),
    initialX=p.num("initialX",24f).toDouble(),initialY=p.num("initialY",24f).toDouble(),bringToFront=p.bool("bringToFront",true),
    exclusive=p.bool("exclusive"),keepOneExpanded=p.bool("keepOneExpanded"),headingLevel=p.int("headingLevel",3),
    region=p.str("region","auto"),regionThreshold=p.num("regionThreshold",6f).toDouble(),transition=p.str("transition","expressive"),
    defaultExpanded=p.str("defaultExpanded"),
)
internal fun accordionTokenLength(tokens:Map<String,String>,key:String,fallback:Double)=
    tokens[key]?.trim()?.removeSuffix("px")?.toDoubleOrNull() ?: fallback
internal fun accordionTokenDuration(tokens:Map<String,String>,key:String,fallback:Double):Double {
    val v=tokens[key]?.trim() ?: return fallback
    return if(v.endsWith("ms")) v.removeSuffix("ms").toDoubleOrNull() ?: fallback else if(v.endsWith("s")) (v.removeSuffix("s").toDoubleOrNull() ?: return fallback)*1000 else fallback
}

/** Dispatches a source event through the native action scopes; the legacy
 * observer is a target listener so it precedes parent coordination. */
internal fun accordionDispatch(name:String,tag:String,detail:AWCValue,targetID:String,action:AWCActionDispatcher?,target:AWCActionTarget?,legacy:(String,AWCValue)->Unit) {
    @Suppress("UNCHECKED_CAST") val payload=(detail as? Map<String,AWCValue>) ?: emptyMap()
    var observed=false
    val observer:(AWCActionEvent)->Unit={ observed=true;legacy(name,detail) }
    dispatchNativeAction(AWCActionEvent(name,tag,payload,targetID=target?.id ?: targetID),action,listOf(observer)+target?.listeners?.invoke().orEmpty())
    if(!observed) legacy(name,detail)
}

@Composable internal fun NativeAccordionGroup(p:Props,emit:EventSink,slot:Slot?,floatingHolder:NativeAccordionFloatingHolder=remember { NativeAccordionFloatingHolder() }) {
    val configuration=accordionConfiguration(p)
    val state=remember { NativeAccordionState(configuration) }
    val owner=remember(state) { NativeAccordionOwner(state) }
    val inspection=LocalAWCInspection.current
    val actions=LocalAWCAction.current
    val target=LocalAWCActionTarget.current
    val latestEmit=rememberUpdatedState(emit)
    val generatedTarget=remember { java.util.UUID.randomUUID().toString() }
    val scopeID=remember { java.util.UUID.randomUUID().toString() }
    val ownerDispatcher=remember(actions) { AWCActionDispatcher(actions,scopeID) { owner.receive(it) } }
    val appearance=LocalAWCAccordionAppearance.current.normalized()
    val tokens=LocalAWCThemeTokens.current
    val colors=MaterialTheme.colorScheme
    val d=LocalAWCNativeDensity.current
    val (reduced,_)=rememberAWCAccessibilityAppearance()
    val screenDensity=androidx.compose.ui.platform.LocalDensity.current.density
    @Suppress("UNUSED_VARIABLE") val revision=owner.revision
    SideEffect {
        owner.inspection=inspection
        state.emit={ name,detail->accordionDispatch(name,"md-accordion",detail,generatedTarget,actions,target) { n,v->latestEmit.value(n,v) } }
        state.update(configuration)
        val direct=owner.direct()
        if(!owner.connected) {
            owner.connected=true;owner.initializing=true
            try { state.connect(direct.map { it.state }) } finally { owner.initializing=false }
            owner.authored=direct
        } else if(direct.size!=owner.authored.size || direct.zip(owner.authored).any { (a,b)->a!==b }) {
            // Authored membership/order is authoritative when it changes.
            owner.authored=direct;state.synchronize(direct.map { it.state })
        }
    }
    DisposableEffect(owner) { onDispose { state.disconnect();owner.connected=false } }
    val outlined=configuration.variant=="outlined"
    val compactGap=(p["density"] as? Number)?.toDouble()?.let { it<=-3 } ?: false
    val gap=appearance.gap ?: if(compactGap) 4.0 else accordionTokenLength(tokens,"--md-sys-spacing-gap-sm",8.0)
    val chassisShape=appearance.containerShape ?: AWCCornerShape.uniform(max(8.0,12+d))
    val outline=appearance.outlineColor?.let(::statusDotColor) ?: colors.outlineVariant
    val level=configuration.elevation.takeIf { it in 1..5 } ?: 0
    val chassisShadow=appearance.elevation?.map { it.resolved() } ?: NativeShadowLayer.parse(tokens["--md-sys-elevation-$level"])
    val scope=rememberCoroutineScope()
    val (shiftTiming,glideTiming)=NativeAccordionReorderMotion.timing(configuration.transition,reduced,tokens)
    val placeholder=state.dropPlaceholder
    val draggedID=state.draggedItemID
    val siblingTargets=state.siblingOffsets
    val inspector=LocalAWCAccordionReorderInspector.current
    // ---- floating panel (position: fixed) ----
    val floating=configuration.floating
    val zIndex=state.zIndex
    val chassisDragging=state.chassisDragging
    val viewport=LocalAWCAccordionViewport.current
    val view=androidx.compose.ui.platform.LocalView.current
    val viewportWidth=(viewport?.size?.width?.takeIf { it>0 } ?: view.width)/screenDensity.toDouble()
    val panelWidth=minOf(appearance.floatingWidth ?: 360.0,viewportWidth-16.0).coerceAtLeast(0.0)
    val panelShape=appearance.floatingRadius ?: AWCCornerShape.uniform(accordionTokenLength(tokens,"--md-sys-shape-corner-large",16.0))
    val panelBackground=appearance.floatingBackground?.let(::statusDotColor) ?: colors.surfaceContainerLow
    // forced-colors: the floating panel's box-shadow is forced to none; `border: 1px solid CanvasText`.
    val forcedPalette=awcForcedColors()
    val panelRest=if(forcedPalette!=null) emptyList() else appearance.floatingElevation?.map { it.resolved() } ?: NativeShadowLayer.parse(tokens["--md-sys-elevation-3"])
    val panelActive=if(forcedPalette!=null) emptyList() else appearance.floatingElevationActive?.map { it.resolved() } ?: NativeShadowLayer.parse(tokens["--md-sys-elevation-5"])
    val panelTiming=NativeAccordionReorderMotion.Timing(
        if(reduced || configuration.transition=="none") 0.0 else accordionCSSDuration(tokens["--md-sys-motion-spring-effects-default-duration"]) ?: 200.0,
        accordionCSSCubicBezier(tokens["--md-sys-motion-spring-effects-default-easing"]) ?: listOf(.34,.8,.34,1.0))
    SideEffect {
        // A fixed panel without bring-to-front keeps the stylesheet z-index 1000; in flow there is none.
        floatingHolder.zIndex=if(floating) (zIndex ?: 1000).toFloat() else null
        owner.panelTiming=panelTiming
        if(owner.panelElevation.value!=(if(chassisDragging) 1.0 else 0.0)) owner.requestMotion()
        inspector?.invoke(owner.reorderInspection)
        owner.scope=scope;owner.shiftTiming=shiftTiming;owner.glideTiming=glideTiming
        // Style changes that did not come through the reorder gesture (or a finished drag).
        if(draggedID==null) { if(owner.motion.differs(null,emptyList(),emptyMap(),null)) owner.endMotion() }
        else if(owner.motion.differs(draggedID,state.items.map { it.id },siblingTargets,placeholder?.top)) owner.requestMotion()
    }
    val groupCursor=if(chassisDragging) AWCCursorStyle.Grabbing else null
    val groupModifier=Modifier.awcCursor(groupCursor,stable=true).then(if(floating) Modifier
            .accordionFloatingPlacement({ viewport?.origin ?: androidx.compose.ui.geometry.Offset.Zero },{ state.x },{ state.y },(panelWidth*screenDensity).roundToInt())
            .accordionShadow(panelShape,{ NativeShadowLayer.interpolate(panelRest,panelActive,owner.panelElevation.presented(owner.frameMillis).also { owner.motionVersion }) },false)
            .clip(panelShape).background(panelBackground,panelShape)
            .inspectAWCNode(inspection,"floating-panel","floating-panel")
            .then(if(forcedPalette!=null) Modifier.border(1.dp,awcColor(forcedPalette.canvasText,Color.White),panelShape).awcBorderInset(1.dp) else Modifier)
        else Modifier.fillMaxWidth()
            .then(if(outlined) Modifier.accordionShadow(chassisShape,chassisShadow,false).clip(chassisShape).border(1.dp,outline,chassisShape) else Modifier))
        .onGloballyPositioned { owner.rootBounds=it.boundsInRoot();owner.density=screenDensity }
        .then(AccordionGroupMarkerElement(owner))
    val layerID=remember { "floating-panel#"+System.identityHashCode(owner) }
    val panel:@Composable ()->Unit={ Layout(content={
        if(placeholder!=null) {
            // ::part(drop-placeholder) declarations win over the hooks (outer part rules over the inner sheet).
            val pp=LocalAWCAccordionParts.current[AWCAccordionPart.DropPlaceholder]?.normalized() ?: AWCAccordionPartAppearance()
            val color=(pp.backgroundColor ?: appearance.dropPlaceholderColor)?.let(::statusDotColor) ?: colors.primaryContainer.copy(alpha=colors.primaryContainer.alpha*.45f)
            val stroke=(pp.borderColor ?: appearance.dropPlaceholderOutlineColor)?.let(::statusDotColor) ?: colors.primary.copy(alpha=colors.primary.alpha*.55f)
            val shape=pp.cornerShape ?: appearance.dropPlaceholderShape ?: chassisShape
            Box(Modifier.layoutId(AccordionPlaceholderID).inspectAWCNode(inspection,"drop-placeholder","drop-placeholder")
                .alpha((pp.opacity ?: appearance.dropPlaceholderOpacity ?: 1.0).toFloat()).background(color,shape)
                .accordionDashedBorder(shape,pp.borderWidth ?: appearance.dropPlaceholderOutlineWidth ?: 2.0,stroke).clearAndSetSemantics {})
        }
        CompositionLocalProvider(LocalNativeAccordionOwner provides owner,LocalAWCAction provides ownerDispatcher,LocalAWCActionTarget provides null) {
            slot?.invoke("")
        }
    },modifier=groupModifier) { measurables,constraints->
        // Outlined floating: the chassis drops its border (one clean silhouette).
        val border=if(outlined && !floating) 1.dp.roundToPx() else 0
        val width=if(constraints.hasBoundedWidth) constraints.maxWidth else constraints.minWidth
        val inner=(width-2*border).coerceAtLeast(0)
        val ghost=measurables.firstOrNull { it.layoutId===AccordionPlaceholderID }
        val children=measurables.filter { it.layoutId!==AccordionPlaceholderID }
        val direct=children.mapNotNull { it.layoutId as? NativeAccordionChild }
        val previous=owner.measured
        if(previous==null || previous.size!=direct.size || previous.zip(direct).any { (a,b)->a!==b }) {
            owner.measured=direct
            if(owner.connected && (direct.size!=owner.authored.size || direct.zip(owner.authored).any { (a,b)->a!==b })) owner.revision++
        }
        // Item slots follow the retained display order; other children keep their place.
        val display=state.items
        val ordered=children.toMutableList()
        val slots=children.indices.filter { children[it].layoutId is NativeAccordionChild }
        if(display.size==slots.size && display.all { s->direct.any { it.state===s } })
            slots.forEachIndexed { k,i-> ordered[i]=children.first { (it.layoutId as? NativeAccordionChild)?.state===display[k] } }
        val placeables=ordered.map { it.measure(Constraints(minWidth=inner,maxWidth=inner)) }
        val gapPx=if(outlined) 0 else (gap*density).roundToInt()
        // Hidden items (`display: none`) keep their slot in coordination but take no space and no gap.
        val shown=ordered.map { (it.layoutId as? NativeAccordionChild)?.state?.hidden!=true }
        val height=placeables.filterIndexed { i,_->shown[i] }.sumOf { it.height }+gapPx*(shown.count { it }-1).coerceAtLeast(0)+2*border
        val ghostPlaceable=if(ghost!=null && placeholder!=null) ghost.measure(Constraints.fixed(inner,(placeholder.height*density).roundToInt().coerceAtLeast(0))) else null
        layout(width,height) {
            // Placement reads the frame clock: transitions re-place without recomposition.
            @Suppress("UNUSED_VARIABLE") val version=owner.motionVersion
            val now=owner.frameMillis
            val dragging=state.draggedItemID!=null
            val ghostTop=(if(dragging) owner.motion.placeholderTop(now) else null) ?: placeholder?.top ?: 0.0
            ghostPlaceable?.placeRelative(border,border+(ghostTop*density).roundToInt(),0f)
            var y=border
            ordered.forEachIndexed { i,m->
                val id=(m.layoutId as? NativeAccordionChild)?.state?.id
                val dragged=id!=null && state.draggedItemID==id
                val offset=if(id==null || !dragging) 0f else if(dragged) state.draggedOffset.toFloat() else owner.motion.offset(id,now).toFloat()
                placeables[i].placeRelative(border,y+(offset*density).roundToInt(),if(dragged) 10f else 1f)
                if(shown[i]) y+=placeables[i].height+gapPx
            }
        }
    } }
    // Mechanism 2 (r3-19): under an AWCModalScope the floating panel is an entry of the scope's overlay (no ancestor clips it, it orders
    // against sheets and dialogs by z-index); a zero-size placeholder stays in the flow. Without a scope it stays in place (mechanism 1).
    AccordionFloatingLayer(floating,layerID,(zIndex ?: 1000)+0.001,panel)
}
