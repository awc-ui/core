package dev.awc.nativeui

import android.animation.ValueAnimator
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.waitForUpOrCancellation
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.PressInteraction
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.focus.*
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.*
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.input.key.*
import androidx.compose.ui.input.pointer.PointerEventType
import androidx.compose.ui.input.pointer.PointerType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.*
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.math.ceil
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

// md-menu, md-menu-item, md-sub-menu-item, md-menu-item-group: dedicated Compose renderers.
// Contract: docs/native-parity/md-menu-source-review.md; geometry and colours from the source CSS (NativeMenuSupport.kt).

/** Where a row sits in its menu (the `::slotted` / `:first-child` / `data-*` inputs of the source CSS). */
internal data class NativeMenuItemContext(val variant:String="baseline",val directChild:Boolean=true,val gapCard:Boolean=false,val useGap:Boolean=false,
                                          val inGroup:Boolean=false,val groupShape:Double=12.0,val radioScope:String="",val listbox:Boolean=false)
/** One child position of a menu column (rows and groups); the column layout writes its index, the row reads it. */
@Stable internal class NativeMenuSlot {
    var index by mutableIntStateOf(-1);var count by mutableIntStateOf(0);var afterGap by mutableStateOf(false)
    var gap=false;var visible=true;var item=false
    val first get()=index==0
    val last get()=count>0 && index==count-1
}
/** A submenu row hosting a nested md-menu (`slot="submenu"`): its frame in the scope and open state. */
internal class NativeMenuFlyoutHost(val rowID:String,val frame:()->Rect?,val open:Boolean)
internal val LocalNativeMenuController=staticCompositionLocalOf<NativeMenuController?> { null }
internal val LocalNativeMenuItemContext=staticCompositionLocalOf<NativeMenuItemContext?> { null }
internal val LocalNativeMenuSlot=staticCompositionLocalOf<NativeMenuSlot?> { null }
internal val LocalNativeMenuFlyoutHost=staticCompositionLocalOf<NativeMenuFlyoutHost?> { null }
/** The inspection collector of the outermost md-menu: rows and nested menus record under their source ids. */
internal val LocalNativeMenuCollector=staticCompositionLocalOf<AWCInspectionCollector?> { null }
private var nativeMenuRegistrations=0.0

internal val MenuRoboto=androidx.compose.ui.text.font.FontFamily(androidx.compose.ui.text.font.Font(R.font.awc_roboto_regular,androidx.compose.ui.text.font.FontWeight.Normal),
    androidx.compose.ui.text.font.Font(R.font.awc_roboto_medium,androidx.compose.ui.text.font.FontWeight.Medium))
/** Exact max-content advance (dp) of single-line Roboto text, as Chrome lays it out (fractional advances, kerning). */
internal object NativeMenuText {
    private val faces=mutableMapOf<Int,android.graphics.Typeface>()
    fun width(context:android.content.Context,text:String,size:Double,weight:Int,spacing:Double=0.0):Double {
        if(text.isEmpty()) return 0.0
        val face=faces.getOrPut(weight) { context.resources.getFont(if(weight>=500) R.font.awc_roboto_medium else R.font.awc_roboto_regular) }
        val paint=android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG or android.graphics.Paint.SUBPIXEL_TEXT_FLAG or android.graphics.Paint.LINEAR_TEXT_FLAG)
        paint.typeface=face;paint.textSize=(size*64).toFloat()
        if(spacing!=0.0) paint.letterSpacing=(spacing/size).toFloat()
        return paint.measureText(text)/64.0
    }
}

// MARK: - md-menu

@Composable internal fun NativeMenu(p:Props,onEvent:EventSink,content:Slot?) {
    val registry=LocalNativeMenuRegistry.current
    val parentController=LocalNativeMenuController.current
    val flyout=LocalNativeMenuFlyoutHost.current
    val model=NativeMenuModel.from(p)
    val generated=remember { "menu-"+java.util.UUID.randomUUID().toString().take(8) }
    val id=p.str("id").ifEmpty { generated }
    val controller=remember(id) { NativeMenuController(id) }
    val scope=rememberCoroutineScope()
    val focusManager=LocalFocusManager.current
    val inspection=LocalAWCMenuInspection.current
    val collector=LocalAWCInspection.current?.collector ?: LocalNativeMenuCollector.current
    SideEffect {
        controller.model=model;controller.scope=scope;controller.registry=registry;controller.focusManager=focusManager
        controller.parent=if(flyout!=null) parentController else null
        controller.emit={ n-> inspection?.events?.add(Triple(n,id,registry?.inputTime ?: Double.NaN));onEvent(n,null) }
        controller.setOpen={ }
        if(model.anchor.isNotEmpty() && registry!=null && !registry.wanted.containsKey(model.anchor)) registry.wanted[model.anchor]=Unit
        val anchor=model.anchor
        controller.focusAnchorAction={ registry?.focusAnchor(anchor) ?: false }
    }
    DisposableEffect(registry,controller) {
        registry?.register(controller)
        val host=flyout;val pc=parentController
        if(host!=null && pc!=null) { controller.parentRowID=host.rowID;pc.children[host.rowID]=controller }
        onDispose { registry?.unregister(controller);if(host!=null && pc!=null && pc.children[host.rowID]===controller) pc.children.remove(host.rowID) }
    }
    // Host-driven `open` changes (the controller's own changes already dispatched their events).
    LaunchedEffect(model.open) {
        if(model.open && !controller.isOpen) controller.show(null,false)
        else if(!model.open && controller.isOpen) { controller.isOpen=false;controller.closing=false;controller.ringed=null;controller.emit("mdClose") }
    }
    if(model.hidden) return
    val showing=controller.isOpen || controller.closing || controller.lingering
    val surface:@Composable ()->Unit={
        CompositionLocalProvider(LocalNativeMenuController provides controller,LocalNativeMenuCollector provides collector,LocalNativeMenuFlyoutHost provides null,
            LocalNativeMenuItemContext provides null,LocalNativeMenuSlot provides null) {
            NativeMenuMotionSurface(controller,model,id,flyout,registry,anchored=model.anchor.isNotEmpty() && registry!=null,collector) { slot-> content?.invoke(slot) }
        }
    }
    if((flyout!=null || model.anchor.isNotEmpty()) && registry!=null) {
        // Top layer: the surface composes in the scope with this position's composition locals.
        val locals=currentCompositionLocalContext
        val entryContent=rememberUpdatedState<@Composable ()->Unit> { CompositionLocalProvider(locals) { surface() } }
        val depth=run { var d=0;var c=parentController.takeIf { flyout!=null };while(c!=null) { d++;c=c.parent };d }
        DisposableEffect(registry,showing) {
            val entry=if(showing) NativeMenuEntry(id,depth,entryContent).also { registry.entries+=it } else null
            onDispose { entry?.let { registry.entries.remove(it) } }
        }
    } else if(showing) surface()
}

/** Shared between the placement layout and the surface's measure pass (no recomposition). */
private class NativeMenuGeometry {
    var viewport=Size(1200f,900f);var rtl=false
    var placement:NativeMenuPlacement?=null
}

/** Open / close motion (opacity + scaleY 0.8 from the placement corner) around the positioned surface. */
@Composable private fun NativeMenuMotionSurface(controller:NativeMenuController,model:NativeMenuModel,id:String,flyout:NativeMenuFlyoutHost?,registry:NativeMenuRegistry?,
                                                anchored:Boolean,collector:AWCInspectionCollector?,content:@Composable (String)->Unit) {
    val reduced=LocalAWCMenuReducedMotion.current ?: !ValueAnimator.areAnimatorsEnabled()
    val inspection=LocalAWCMenuInspection.current
    val track=remember { AWCCSSTransitionTrack().also { it.snap(if(model.quick) 1.0 else 0.0) } }
    var frame by remember { mutableDoubleStateOf(0.0) }
    var primed by remember { mutableStateOf(false) }
    val target=if(controller.isOpen && !controller.closing) 1.0 else 0.0
    val fm=1000.0/(LocalView.current.display?.refreshRate?.takeIf { it>0f }?.toDouble() ?: 60.0)
    LaunchedEffect(target) {
        val f=withFrameNanos { it }/1e6
        // When Chrome starts the transition: an input event (timeline-stamped with the frame it arrived in) restyles in
        // the next frame and the transition starts one frame later (+2 frames); a timer's change starts in the frame that
        // applies it (the frame before this resumed effect); without a fresh time, as an input in the previous frame.
        fun startAt(t:Double)=when {
            t==Double.NEGATIVE_INFINITY->f-fm
            !t.isNaN() && f-t>=0 && f-t<=4*fm->t+2*fm
            else->f+fm }
        fun start(next:Double) {
            val at=startAt(if(next==1.0) controller.openedAt else controller.closingAt)
            if(next==1.0 && controller.parent!=null && !(model.quick || reduced)) { track.snap(0.0);track.set(1.0,at,.001,listOf(0.0,0.0,1.0,1.0));return }
            if(model.quick || reduced || (next==1.0 && controller.parent!=null)) { if(f<at) track.set(next,at,.001,listOf(0.0,0.0,1.0,1.0)) else track.snap(next);return }
            track.set(next,at,150.0,if(next==1.0) listOf(.05,.7,.1,1.0) else listOf(.3,0.0,.8,.15))
        }
        if(!primed) { primed=true;if(model.quick || reduced) track.snap(target) else if(track.presented(f)!=target) start(target) }
        else start(target)
        frame=f
        while(track.isRunning(frame)) frame=withFrameNanos { it }/1e6
    }
    // Quick / reduced menus snap: the first composition already paints the snapped state.
    val progress={ t:Double-> if(!primed && (model.quick || reduced)) target else track.presented(t) }
    val geometry=remember { NativeMenuGeometry() }
    val rtl=LocalLayoutDirection.current==LayoutDirection.Rtl
    val density=LocalDensity.current.density
    val inspect=remember(collector,id) { collector?.let { AWCInspectionContext(it,id,true,null) } }
    val record={ t:Double-> val pr=progress(t)
        inspection?.menus?.set(id,(inspection.menus[id] ?: emptyMap())+mapOf("progress" to pr,"scaleY" to (if(reduced) 1.0 else .8+.2*pr),"open" to controller.isOpen,
            "closing" to controller.closing,"frame" to t)) }
    SideEffect { record(frame) }
    val surface=@Composable {
        NativeMenuSurface(controller,model,id,inspect,geometry,flyout!=null || anchored,flyout,
            Modifier.graphicsLayer {
                val pr=progress(frame).toFloat()
                alpha=pr;scaleY=if(reduced) 1f else .8f+.2f*pr
                val pl=geometry.placement
                transformOrigin=TransformOrigin(pl?.originX ?: 0f,pl?.originY ?: 0f)
            }.drawBehind { record(frame) },content)
    }
    if(registry==null || (flyout==null && !anchored)) { surface();return }
    // Positioned in the scope viewport (physical coordinates; the surface keeps the menu's own direction). The surface
    // resolves its placement while it measures; until the anchor is known it stays off screen.
    Layout(surface,Modifier.fillMaxSize()) { measurables,constraints->
        val placeable=measurables.first().measure(Constraints(0,constraints.maxWidth,0,constraints.maxHeight))
        val pl=geometry.placement
        val x=((pl?.x ?: -10000.0)*density).roundToInt();val y=((pl?.y ?: -10000.0)*density).roundToInt()
        layout(constraints.maxWidth,constraints.maxHeight) { placeable.place(x,y) }
    }
}

/** The menu's accessible name: a listbox's list label, else its anchor's name (Web ariaLabelledByElements = [anchor]); a flyout's is its submenu row's. */
private fun menuName(model:NativeMenuModel,registry:NativeMenuRegistry?,controller:NativeMenuController):String =
    if(model.listbox) model.listLabel else registry?.anchorLabels?.get(controller.parentRowID ?: model.anchor).orEmpty()

/** `.md-menu__surface`: header slot, the capped scroll viewport and the rows / empty text. */
@Composable private fun NativeMenuSurface(controller:NativeMenuController,model:NativeMenuModel,id:String,inspect:AWCInspectionContext?,geometry:NativeMenuGeometry,
                                          positioned:Boolean,flyout:NativeMenuFlyoutHost?,motion:Modifier,content:@Composable (String)->Unit) {
    val tokens=LocalAWCThemeTokens.current
    val appearance=LocalAWCMenuAppearance.current
    val inheritedRung=LocalAWCNativeDensity.current
    val registry=LocalNativeMenuRegistry.current
    val inspection=LocalAWCMenuInspection.current
    val configuration=androidx.compose.ui.platform.LocalConfiguration.current
    val rung=model.density?.takeIf { it<=-2 } ?: (if(inheritedRung<=-2) inheritedRung else 0.0)
    val sp=NativeMenuSpacing(rung);val palette=NativeMenuPalette(tokens)
    val styled=model.variant!="baseline";val cards=model.groupedGapCards
    val padV=if(cards) 0.0 else sp.insetXS;val padH=if(cards) 0.0 else if(styled) sp.insetXS else 0.0
    fun px(s:String?)=s?.replace("px","")?.trim()?.toDoubleOrNull()
    val radius=if(styled) px(tokens["--md-sys-shape-corner-large"]) ?: 16.0 else px(tokens["--md-sys-shape-corner-small"]) ?: 8.0
    val shape=AWCCornerShape.uniform(radius)
    val slots=remember { NativeMenuSlots() }
    val vp=registry?.viewport?.takeIf { it.width>0f } ?: Size(configuration.screenWidthDp.toFloat(),configuration.screenHeightDp.toFloat())
    val context=NativeMenuItemContext(model.variant,true,cards,model.useGap,false,
        NativeMenuLength.parse(appearance.groupContainerShape)?.resolve(vp) ?: 12.0,id,model.listbox)
    val sectioned=slots.sectioned && model.variant=="baseline"
    val sectionGap=NativeMenuLength.parse(appearance.sectionGap)?.resolve(vp) ?: 2.0
    val groupGap=if(cards) NativeMenuLength.parse(appearance.groupGap)?.resolve(vp) ?: 4.0 else 0.0
    val pointerOver=remember { booleanArrayOf(false) }
    val hoverChanged={ inside:Boolean->
        if(controller.pointerInside!=inside) {
            controller.pointerInside=inside
            // Entering the flyout keeps its row open; leaving it starts the row's close intent.
            val parent=controller.parent;val row=controller.parentRowID
            if(parent!=null && row!=null) { if(inside) parent.rows[row]?.openSubmenu?.invoke(false) else parent.rows[row]?.hoverLeave?.invoke() }
        }
    }
    Box(motion
        .onGloballyPositioned { c-> registry?.rect(c)?.let { r-> registry.surfaces[id]=r;controller.surfaceRect=r } }
        .pointerInput(controller) { awaitPointerEventScope { while(true) { val e=awaitPointerEvent()
            val c=e.changes.firstOrNull() ?: continue
            if(c.type!=PointerType.Mouse && e.type!=PointerEventType.Exit) continue
            val p=c.position;val inside=e.type!=PointerEventType.Exit && p.x>=0 && p.y>=0 && p.x<size.width && p.y<size.height
            if(pointerOver[0]!=inside) { pointerOver[0]=inside;hoverChanged(inside) } } } }
        .then(if(inspect!=null) Modifier.inspectAWCNode(inspect,"","md-menu") else Modifier)
        .semantics { isTraversalGroup=true;val name=menuName(model,registry,controller);if(name.isNotEmpty()) paneTitle=name }) {
        Box(Modifier
            .then(if(!cards) Modifier.accordionShadow(shape,NativeMenuPalette.surfaceShadow(model.variant),false) else Modifier)
            .then(if(!cards) Modifier.background(statusDotColor(palette.surface(model.variant)),shape) else Modifier)
            .then(if(inspect!=null) Modifier.inspectAWCNode(inspect,"surface","surface") else Modifier)
            .padding(horizontal=padH.dp,vertical=padV.dp)) {
            NativeMenuSurfaceLayout(model,geometry,vp,padH,padV,positioned,flyout,controller,appearance,registry) {
                Box(Modifier.layoutId("header")) { content("header") }
                Box(Modifier.layoutId("viewport")
                    .onGloballyPositioned { c-> registry?.rect(c)?.let { controller.viewportRect=it } }
                    .then(if(inspect!=null) Modifier.inspectAWCNode(inspect,"menu-viewport","menu-viewport") else Modifier))
                Column(Modifier.layoutId("column")) {
                    CompositionLocalProvider(LocalNativeMenuItemContext provides context,LocalNativeMenuSlots provides slots) {
                        NativeMenuColumn(groupGap,if(sectioned) sectionGap else 0.0,slots) { content("") }
                    }
                    if(slots.visibleItems==0 && model.emptyText.isNotEmpty()) {
                        BasicText(model.emptyText,Modifier.fillMaxWidth().then(if(inspect!=null) Modifier.inspectAWCNode(inspect,"empty-text","empty-text") else Modifier)
                            .padding(vertical=sp.insetMD.dp,horizontal=sp.insetLG.dp),
                            style=listTextStyle(14.0,20.0,400,0.0,statusDotColor(palette.emptyInk)).copy(textAlign=androidx.compose.ui.text.style.TextAlign.Center))
                    }
                }
            }
        }
    }
    SideEffect { inspection?.menus?.set(id,(inspection.menus[id] ?: emptyMap())+mapOf("role" to (if(model.listbox) "presentation" else "menu"),"variant" to model.variant,
        "radius" to radius,"scrollTop" to controller.scrollTop,"cap" to (geometry.placement?.cap ?: -1.0))) }
}

/** Clips a child to the scroll viewport (its own coordinates: the band [top, top + height)). */
private class NativeMenuBand(val top:Float,val height:Float):Shape {
    override fun createOutline(size:Size,layoutDirection:LayoutDirection,density:androidx.compose.ui.unit.Density)=Outline.Rectangle(Rect(0f,top,size.width,top+height))
}
/**
 * Width (max-content clamped by the hooks), header, the rows' natural height, then the placement (positionMenu /
 * autoPositionSubmenu) and the capped, scrolled viewport, all in one measure pass.
 */
@Composable private fun NativeMenuSurfaceLayout(model:NativeMenuModel,geometry:NativeMenuGeometry,viewport:Size,padH:Double,padV:Double,positioned:Boolean,
                                                flyout:NativeMenuFlyoutHost?,controller:NativeMenuController,appearance:AWCMenuAppearance,registry:NativeMenuRegistry?,content:@Composable ()->Unit) {
    val density=LocalDensity.current.density
    val rtl=LocalLayoutDirection.current==LayoutDirection.Rtl
    Layout(content) { measurables,constraints->
        controller.repositions
        val vp=if(positioned && registry!=null && registry.viewport.width>0f) registry.viewport else viewport
        val anchor=if(positioned && flyout==null && registry!=null) registry.anchors[model.anchor] else null
        val row=if(positioned) flyout?.frame?.invoke() else null
        val m=NativeMenuPlacement.margin(appearance,vp)
        val minW=NativeMenuLength.parse(appearance.minWidth)?.resolve(vp) ?: 112.0
        val maxW=min(NativeMenuLength.parse(appearance.maxWidth)?.resolve(vp) ?: vp.width.toDouble(),vp.width-2*m)
        val head=measurables.first { it.layoutId=="header" };val marker=measurables.first { it.layoutId=="viewport" };val body=measurables.first { it.layoutId=="column" }
        val natural=max(head.maxIntrinsicWidth(Constraints.Infinity),body.maxIntrinsicWidth(Constraints.Infinity))/density.toDouble()
        val responsive=positioned && flyout==null && model.responsive && vp.width<=600
        val inner=when {
            responsive->vp.width-2*m-2*padH
            model.matchAnchorWidth && anchor!=null->min(max(natural+2*padH,anchor.width.toDouble()),vp.width-2*m)-2*padH
            else->min(max(natural,minW),maxW)
        }
        val w=(inner*density).roundToInt().coerceAtLeast(0)
        val hp=head.measure(Constraints.fixedWidth(w))
        val cp=body.measure(Constraints(w,w,0,Constraints.Infinity))
        val chrome=hp.height/density.toDouble()+2*padV;val contentH=cp.height/density.toDouble();val surfaceW=w/density.toDouble()+2*padH
        val baseCap=NativeMenuPlacement.defaultCap(model,appearance,vp,m)
        val pl=when {
            row!=null->{ val (x,y)=NativeMenuPlacement.submenu(row,surfaceW,chrome+min(contentH,baseCap),vp,rtl);NativeMenuPlacement(x,y,surfaceW,baseCap,"bottom","start",false) }
            anchor!=null->NativeMenuPlacement.resolve(anchor,surfaceW,chrome,contentH,vp,model,appearance)
            else->null }
        geometry.placement=pl;geometry.viewport=vp;geometry.rtl=rtl
        val cap=pl?.cap ?: baseCap
        val vh=min(cp.height,(cap*density).roundToInt())
        controller.contentHeight=contentH;controller.viewportHeight=vh/density.toDouble()
        val top=(controller.scrollTop.coerceIn(0.0,max(0.0,contentH-vh/density.toDouble()))*density).roundToInt()
        val mp=marker.measure(Constraints.fixed(w,vh))
        layout(w,hp.height+vh) {
            hp.place(0,0);mp.place(0,hp.height)
            cp.placeWithLayer(0,hp.height-top) { clip=true;shape=NativeMenuBand(top.toFloat(),vh.toFloat()) }
        }
    }
}

/** Registered children of one menu column (visibility, gaps, submenus). */
@Stable internal class NativeMenuSlots {
    val entries=mutableStateMapOf<NativeMenuSlot,Triple<Boolean,Boolean,Boolean>>()   // visible item, gap, has submenu
    val visibleItems get()=entries.values.count { it.first }
    val sectioned get()=entries.values.any { it.second }
    val hasSub get()=entries.values.any { it.third }
}
internal val LocalNativeMenuSlots=staticCompositionLocalOf<NativeMenuSlots?> { null }

/** Column of rows / groups: max-content width = widest child; each child placed at the full width. */
@Composable private fun NativeMenuColumn(gap:Double,sectionGap:Double,slots:NativeMenuSlots,content:@Composable ()->Unit) {
    val density=LocalDensity.current.density
    Layout(content,measurePolicy=object:MeasurePolicy {
        override fun MeasureScope.measure(measurables:List<Measurable>,constraints:Constraints):MeasureResult {
            val w=constraints.maxWidth.takeIf { it!=Constraints.Infinity } ?: measurables.maxOfOrNull { it.maxIntrinsicWidth(Constraints.Infinity) } ?: 0
            val slotsOf=measurables.map { it.parentData as? NativeMenuSlot }
            val ps=measurables.map { it.measure(Constraints(w,w,0,Constraints.Infinity)) }
            // Index among the rendered (non-empty) children, as the source's :first-child / :last-child / data-* do.
            val shown=ps.indices.filter { ps[it].height>0 }
            shown.forEachIndexed { k,i-> slotsOf[i]?.let { s-> if(s.index!=k) s.index=k;if(s.count!=shown.size) s.count=shown.size
                val ag=k>0 && slotsOf[shown[k-1]]?.gap==true;if(s.afterGap!=ag) s.afterGap=ag } }
            val g=(gap*density).roundToInt();val sg=(sectionGap*density).roundToInt()
            var h=0;shown.forEachIndexed { k,i-> h+=ps[i].height+(if(k<shown.size-1) g else 0)+(if(slotsOf[i]?.gap==true && k<shown.size-1) sg else 0) }
            return layout(w,h) { var y=0;shown.forEachIndexed { k,i-> ps[i].place(0,y);y+=ps[i].height+g+(if(slotsOf[i]?.gap==true && k<shown.size-1) sg else 0) } }
        }
        override fun IntrinsicMeasureScope.maxIntrinsicWidth(measurables:List<IntrinsicMeasurable>,height:Int)=measurables.maxOfOrNull { it.maxIntrinsicWidth(height) } ?: 0
        override fun IntrinsicMeasureScope.minIntrinsicWidth(measurables:List<IntrinsicMeasurable>,height:Int)=measurables.maxOfOrNull { it.minIntrinsicWidth(height) } ?: 0
    })
}

/** AWCComponent wraps md-menu-item / md-sub-menu-item / md-menu-item-group in this slot so the column can index it. */
@Composable internal fun rememberNativeMenuSlot(tag:String,p:Props):NativeMenuSlot? {
    if(tag !in setOf("md-menu-item","md-sub-menu-item","md-menu-item-group")) return null
    val slots=LocalNativeMenuSlots.current ?: return null
    val slot=remember { NativeMenuSlot() }
    slot.gap=p.bool("gap");slot.item=true
    val hidden=p.bool("hidden")
    val info=Triple(!hidden,p.bool("gap"),tag=="md-sub-menu-item")
    DisposableEffect(slots,slot) { onDispose { slots.entries.remove(slot) } }
    SideEffect { if(slots.entries[slot]!=info) slots.entries[slot]=info }
    return slot
}
internal fun Modifier.nativeMenuSlot(slot:NativeMenuSlot?)=if(slot==null) this else this.then(NativeMenuSlotData(slot))
private class NativeMenuSlotData(val slot:NativeMenuSlot):ParentDataModifier {
    override fun androidx.compose.ui.unit.Density.modifyParentData(parentData:Any?)=slot
    override fun equals(other:Any?)=other is NativeMenuSlotData && other.slot===slot
    override fun hashCode()=System.identityHashCode(slot)
}

/**
 * md-ripple as Chrome runs it inside md-menu-item: the wave's Web Animation starts when it is ready, two frames after the
 * press (or the keyboard `trigger()`), grows 450 ms (cubic-bezier(0.2, 0, 0, 1), opacity 0.12), and the release fade
 * (150 ms, same easing) is created when the grow finishes or at the release, starting one frame later. Times are
 * frame-clock ms; md-ripple ignores reduced motion (Web Animations).
 */
@Stable internal class NativeMenuRipple(private val fm:Double) {
    var start by mutableDoubleStateOf(Double.NaN);var release by mutableDoubleStateOf(Double.NaN)
    var origin:Offset?=null
    var frame by mutableDoubleStateOf(0.0)
    var token by mutableIntStateOf(0)
    fun press(at:Double,o:Offset) { start=at+2*fm;release=Double.NaN;origin=o;token++ }
    fun up(at:Double) { if(!start.isNaN() && release.isNaN()) release=at }
    fun trigger(at:Double) { start=at+2*fm;release=at;origin=null;token++ }
    val end get()=if(start.isNaN() || release.isNaN()) Double.POSITIVE_INFINITY else max(start+450,release)+fm+150
    /** (opacity, scale) at [t]. */
    fun wave(t:Double):Pair<Double,Double> {
        if(start.isNaN() || t<start) return 0.0 to 0.0
        val growth=accordionCubicBezier(min(1.0,(t-start)/450),listOf(.2,0.0,0.0,1.0))
        if(release.isNaN()) return .12 to growth
        val fade=max(start+450,release)+fm
        return .12*(1-accordionCubicBezier(((t-fade)/150).coerceIn(0.0,1.0),listOf(.2,0.0,0.0,1.0))) to growth
    }
}
@Composable internal fun Modifier.nativeMenuRipple(r:NativeMenuRipple,color:Color):Modifier {
    LaunchedEffect(r.token,r.release) { if(r.start.isNaN()) return@LaunchedEffect;var t=withFrameNanos { it }/1e6;r.frame=t
        while(t<=r.end) { t=withFrameNanos { it }/1e6;r.frame=t } }
    return drawWithContent {
        val (a,g)=r.wave(r.frame)
        if(a>0 && g>0) { val o=r.origin ?: center
            val radius=kotlin.math.hypot(max(o.x,size.width-o.x),max(o.y,size.height-o.y))
            drawCircle(color.copy(alpha=color.alpha*a.toFloat()),radius*g.toFloat(),o) }
        drawContent()
    }
}

// MARK: - rows

/** md-menu-item / md-sub-menu-item: the menu's persisted checkbox / radio state wins over the authored property. */
@Composable internal fun NativeMenuRowHost(tag:String,p:Props,onEvent:EventSink,content:Slot?) {
    val controller=LocalNativeMenuController.current
    var local by awcState(p["selected"]) { p.bool("selected") }
    val id=p.str("id")
    val stored=controller?.selection?.get(id)
    val model=NativeMenuItemModel.from(tag,p).let { it.copy(selected=!it.sub && (stored ?: local)) }
    NativeMenuRow(model,p,onEvent,content) { v-> controller?.selection?.set(id,v);local=v }
}

private data class NativeMenuRowTargets(val layer:Double,val corners:List<Double>,val fill:String,val ink:String)
@Stable private class NativeMenuRowTracks {
    val layer=AWCCSSValueTrack(0.0,accordionLerp)
    val corners=List(4) { AWCCSSValueTrack(0.0,accordionLerp) }
    val fill=AWCCSSValueTrack(Color.Transparent,accordionColorLerp)
    val ink=AWCCSSValueTrack(Color.Black,accordionColorLerp)
    var frame by mutableDoubleStateOf(0.0)
    var primed=false
    fun running(t:Double)=layer.isRunning(t) || corners.any { it.isRunning(t) } || fill.isRunning(t) || ink.isRunning(t)
}

@Composable private fun NativeMenuRow(model:NativeMenuItemModel,p:Props,onEvent:EventSink,content:Slot?,setSelected:(Boolean)->Unit) {
    if(model.hidden) return
    val controller=LocalNativeMenuController.current
    val registry=LocalNativeMenuRegistry.current
    val context=LocalNativeMenuItemContext.current ?: NativeMenuItemContext()
    val slot=LocalNativeMenuSlot.current
    val appearance=LocalAWCMenuAppearance.current
    val tokens=LocalAWCThemeTokens.current
    val inspection=LocalAWCMenuInspection.current
    val collector=LocalNativeMenuCollector.current
    val inheritedScale=LocalAWCNativeDensity.current
    val rtl=LocalLayoutDirection.current==LayoutDirection.Rtl
    val reduced=LocalAWCMenuReducedMotion.current ?: !ValueAnimator.areAnimatorsEnabled()
    val densityPx=LocalDensity.current.density
    val ctx=LocalContext.current
    val fm=1000.0/(LocalView.current.display?.refreshRate?.takeIf { it>0f }?.toDouble() ?: 60.0)
    val scale=resolveAWCDensity(model.density,inheritedScale)
    val rung=model.density?.takeIf { it<=-2 } ?: (if(inheritedScale<=-2) inheritedScale else 0.0)
    val viewport=registry?.viewport?.takeIf { it.width>0 } ?: Size(1200f,900f)
    val m=NativeMenuRowMetrics.of(scale,rung,context.variant,model.sub,appearance,viewport)
    val palette=NativeMenuPalette(tokens)
    val fallbackID=remember { "row-"+java.util.UUID.randomUUID().toString().take(8) }
    val id=model.id.ifEmpty { fallbackID }
    val requester=remember { FocusRequester() }
    val showFocus=remember { mutableStateOf(false) };val pending=remember { mutableStateOf(false) }
    var focused by remember { mutableStateOf(false) }
    var hovered by remember { mutableStateOf(false) }
    var held by remember { mutableStateOf(false) }
    var subOpen by remember { mutableStateOf(false) }
    var openTimer by remember { mutableIntStateOf(0) }
    val ripple=remember { NativeMenuRipple(fm) }
    val scope=rememberCoroutineScope()
    val tracks=remember { NativeMenuRowTracks() }
    val rowRect=remember { arrayOfNulls<Rect>(1) }
    val input=remember { doubleArrayOf(Double.NaN,0.0) }
    fun noteInput(ms:Double,key:Boolean=false) { input[0]=ms;input[1]=if(key) 1.0 else 0.0;registry?.inputTime=ms }
    val hover=!model.disabled && hovered
    val active=!model.disabled && held
    val ring=focused && showFocus.value
    val c=context
    val corners=NativeMenuRowCorners.resolve(c.variant,slot?.first ?: true,slot?.last ?: true,slot?.afterGap ?: false,model.gap,c.directChild,hover,active,model.selected,model.sub)
    val targets=NativeMenuRowTargets(if(active || ring) .12 else if(hover || (model.sub && subOpen)) .08 else 0.0,corners.values,
        if(model.selected) palette.selectedFill(c.variant) else "#00000000",palette.ink(c.variant,model.selected))
    LaunchedEffect(targets,reduced) {
        val f=withFrameNanos { it }/1e6
        if(!tracks.primed) {
            tracks.layer.snap(targets.layer);targets.corners.forEachIndexed { i,v-> tracks.corners[i].snap(v) }
            tracks.fill.snap(statusDotColor(targets.fill));tracks.ink.snap(statusDotColor(targets.ink));tracks.primed=true;tracks.frame=f;return@LaunchedEffect
        }
        // The style changed in the frame that handled the input: start there (CSS), else one frame before this one.
        val ref=input[0];val fromInput=!ref.isNaN() && f-ref>=0 && f-ref<=4*fm
        val now=if(fromInput) ref else f-fm
        val standard=listOf(.2,0.0,0.0,1.0)
        // State layer: 100 ms while :hover / :active match (md-menu-item) and always on submenu rows; leaving is instant on md-menu-item.
        val entering=targets.layer>tracks.layer.presented(now)
        tracks.layer.set(targets.layer,now,if(model.sub || entering) 100.0 else 0.0,standard)
        targets.corners.forEachIndexed { i,v-> tracks.corners[i].set(v,now,if(reduced) 0.0 else 300.0,listOf(.05,.7,.1,1.0)) }
        tracks.fill.set(statusDotColor(targets.fill),now,if(reduced) 0.0 else 150.0,standard)
        tracks.ink.set(statusDotColor(targets.ink),now,if(reduced) 0.0 else 150.0,standard)
        tracks.frame=if(fromInput && input[1]==1.0) f else now
        while(tracks.running(tracks.frame)) tracks.frame=withFrameNanos { it }/1e6
        tracks.frame=withFrameNanos { it }/1e6
    }
    // MARK: actions
    fun click() {
        if(model.disabled) return
        if(model.sub) { nativeMenuEmit(onEvent,inspection,controller,id,"mdClick");return }
        if(model.type=="checkbox") setSelected(!model.selected)
        else if(model.type=="radio") { setSelected(true);controller?.select(id) }
        nativeMenuEmit(onEvent,inspection,controller,id,"mdClick")
        if(!model.keepOpen) controller?.activated()
    }
    fun openSub(autoFocus:Boolean,at:Double=Double.NaN) {
        val ctl=controller ?: return
        if(!model.sub || model.disabled) return
        openTimer++
        if(!subOpen) ctl.rows.forEach { (other,r)-> if(other!=id && r.sub) r.collapse() }
        subOpen=true;ctl.openSubmenu=id
        ctl.children[id]?.show(autoFocus,autoFocus,at)
        if(autoFocus) showFocus.value=false
    }
    fun collapseSub() { openTimer++;if(!subOpen) return;subOpen=false;if(controller?.openSubmenu==id) controller.openSubmenu=null;controller?.children?.get(id)?.closeNow() }
    /** `closeSubmenu()`: the flyout's exit starts now; the row stays open (state layer, caret, aria-expanded) for 100 ms. */
    fun closeSubAnimated() {
        openTimer++;val token=openTimer
        if(!subOpen) return
        controller?.children?.get(id)?.close()
        scope.launch { delay(100);if(openTimer!=token) return@launch;subOpen=false;if(controller?.openSubmenu==id) controller.openSubmenu=null }
    }
    fun hoverChanged(inside:Boolean) {
        if(!model.sub || model.disabled) return
        openTimer++;val token=openTimer
        if(inside && subOpen) return
        if(!inside && !subOpen) return
        val wait=max(0.0,if(inside) model.openDelay else model.closeDelay)
        // The hover intent's timer starts at the pointer event that changed the hover.
        val started=registry?.inputTime ?: Double.NaN
        scope.launch {
            delay(wait.toLong())
            if(openTimer!=token) return@launch
            if(inside) openSub(false,started+wait)
            else if(controller?.children?.get(id)?.pointerInside==true || hovered) return@launch
            else closeSubAnimated()
        }
    }
    fun keyActivate(key:String) {
        if(model.disabled) return
        ripple.trigger(input[0].takeUnless { it.isNaN() } ?: ripple.frame)
        if(model.sub) { openSub(true);return }
        if(key==" " && model.type!="button") {
            if(model.type=="checkbox") setSelected(!model.selected) else { setSelected(true);controller?.select(id) }
            nativeMenuEmit(onEvent,inspection,controller,id,"mdClick");return
        }
        click()
    }
    fun routeKey(key:String,shift:Boolean,modified:Boolean,time:Double):Boolean {
        if(model.sub && subOpen && (key=="Escape" || key==(if(rtl) "ArrowRight" else "ArrowLeft"))) { closeSubAnimated();controller?.focus(id,true);return true }
        if(model.sub && !model.disabled && key==(if(rtl) "ArrowLeft" else "ArrowRight")) { keyActivate("Enter");return true }
        if(key=="Enter" || key==" ") { keyActivate(key);return true }
        return controller?.key(key,id,shift,modified,rtl,time) ?: false
    }
    // Registration with the menu (roving focus, typeahead, radio scopes, submenus).
    val row=remember(controller) { NativeMenuController.Row(requester,showFocus,pending).also { nativeMenuRegistrations+=1;it.order=nativeMenuRegistrations } }
    SideEffect {
        if(model.sub && registry!=null) model.accessibleName().let { n-> if(registry.anchorLabels[id]!=n) registry.anchorLabels[id]=n }
        row.label=model.headline;row.disabled=model.disabled;row.sub=model.sub;row.radioScope=if(model.type=="radio") c.radioScope else null
        row.deselect={ setSelected(false) };row.openSubmenu={ openSub(it) };row.collapse={ collapseSub() };row.hoverLeave={ hoverChanged(false) };row.closeSubmenu={ closeSubAnimated() }
    }
    DisposableEffect(controller,id) { controller?.register(id,row);onDispose { controller?.unregister(id,row);if(registry?.focusedRow==id) registry.focusedRow=null;inspection?.rows?.remove(id) } }
    LaunchedEffect(hover) { if(tracks.primed) hoverChanged(hover) }
    // MARK: inspection
    val inspect=remember(collector,id) { collector?.let { AWCInspectionContext(it,id,true,null) } }
    val inspectRow={ t:Double-> inspection?.rows?.set(id,mapOf("role" to (if(model.sub) "menuitem" else model.role),"ariaChecked" to model.ariaChecked,"selected" to model.selected,
        "disabled" to model.disabled,"focusRing" to ring,"layerOpacity" to tracks.layer.presented(t),"corners" to tracks.corners.map { it.presented(t) },
        "expanded" to (if(model.sub) subOpen else null),"minHeight" to m.height,"frame" to t,"focused" to focused)) }
    SideEffect { inspectRow(tracks.frame) }
    // MARK: paint
    val shapeAt={ t:Double-> val ph=NativeMenuRowCorners.physical(tracks.corners.map { it.presented(t) },rtl)
        AWCCornerShape(AWCCornerRadius(AWCCornerLength(ph[0]),AWCCornerLength(ph[0])),AWCCornerRadius(AWCCornerLength(ph[1]),AWCCornerLength(ph[1])),
            AWCCornerRadius(AWCCornerLength(ph[2]),AWCCornerLength(ph[2])),AWCCornerRadius(AWCCornerLength(ph[3]),AWCCornerLength(ph[3]))) }
    val t=tracks.frame
    val ink=tracks.ink.presented(t)
    val second=if(model.selected) ink else statusDotColor(palette.secondaryInk(c.variant,false))
    val ringColor=statusDotColor(palette.focusRing);val layerColor=statusDotColor(palette.stateLayer(c.variant))
    val layerShape:AWCCornerShape?=if(c.useGap && c.inGroup) AWCCornerShape.uniform(max(0.0,(if(c.gapCard) c.groupShape else 12.0)-4)) else null
    val bottomPad=if(model.sub && model.divider) 8.0 else 0.0
    val badgeText=model.badge.trim()
    val naturalHeadline=max(NativeMenuText.width(ctx,model.headline,m.headlineSize,400),if(model.supportingText.isEmpty()) 0.0 else NativeMenuText.width(ctx,model.supportingText,m.supportingSize,400))
    val semantics=Modifier.semantics(mergeDescendants=true) {
        when(if(model.sub) "menuitem" else model.role) {
            "menuitemcheckbox"->{ role=Role.Checkbox;toggleableState=when(model.ariaChecked) { "true"->androidx.compose.ui.state.ToggleableState.On;"mixed"->androidx.compose.ui.state.ToggleableState.Indeterminate;else->androidx.compose.ui.state.ToggleableState.Off } }
            "menuitemradio"->{ role=Role.RadioButton;selected=model.selected }
            "option"->{ role=Role.RadioButton;selected=model.selected }
            else->role=Role.Button
        }
        if(model.disabled) disabled()
        if(model.sub) { if(subOpen) collapse { collapseSub();true } else expand { openSub(true);true } }
        if(focused) this.focused=true
    }
    Box(Modifier
        .padding(bottom=bottomPad.dp)
        .then(if(inspect!=null) Modifier.inspectAWCNode(inspect,"",if(model.sub) "md-sub-menu-item" else "md-menu-item") else Modifier)
        .onGloballyPositioned { co-> registry?.rect(co)?.let { r-> rowRect[0]=r;controller?.rowRects?.set(id,r) } }
        .graphicsLayer { alpha=if(model.disabled) .38f else 1f }
        .then(semantics)
        .onKeyEvent { e-> if(e.type!=KeyEventType.KeyDown || !focused) return@onKeyEvent false
            val time=e.nativeKeyEvent.eventTime.toDouble()
            noteInput(time,true);showFocus.value=true
            val key=when(e.key) { Key.DirectionDown->"ArrowDown";Key.DirectionUp->"ArrowUp";Key.MoveHome->"Home";Key.MoveEnd->"End";Key.DirectionRight->"ArrowRight";Key.DirectionLeft->"ArrowLeft"
                Key.Enter,Key.NumPadEnter->"Enter";Key.Spacebar->" ";Key.Escape->"Escape";Key.Tab->"Tab"
                else->e.utf16CodePoint.takeIf { it>32 }?.let { String(Character.toChars(it)) } ?: "" }
            if(key.isEmpty()) return@onKeyEvent false
            routeKey(key,e.isShiftPressed && key=="Tab",e.isCtrlPressed || e.isAltPressed || e.isMetaPressed,time)
        }
        .focusRequester(requester)
        .focusProperties { canFocus=controller?.let { it.isOpen && !it.closing } ?: true }
        .onFocusChanged { s-> if(focused!=s.isFocused) { focused=s.isFocused
            if(s.isFocused) { if(!pending.value) showFocus.value=true;pending.value=false;controller?.didFocus(id);registry?.focusedRow=id }
            else if(registry?.focusedRow==id) registry.focusedRow=null } }
        .focusTarget()
        .pointerInput(model.disabled) { awaitPointerEventScope { while(true) { val e=awaitPointerEvent()
            val ch=e.changes.firstOrNull() ?: continue
            if(ch.type!=PointerType.Mouse && e.type!=PointerEventType.Exit) continue
            noteInput(ch.uptimeMillis.toDouble())
            val pp=ch.position;val inside=e.type!=PointerEventType.Exit && pp.x>=0 && pp.y>=0 && pp.x<size.width && pp.y<size.height
            if(hovered!=inside) hovered=inside } } }
        .pointerInput(model.disabled,controller) { awaitEachGesture {
            val down=awaitFirstDown(requireUnconsumed=false)
            noteInput(down.uptimeMillis.toDouble())
            if(model.disabled) return@awaitEachGesture
            held=true
            controller?.keyboardModality=false
            ripple.press(down.uptimeMillis.toDouble(),down.position)
            if(!focused) { showFocus.value=false;pending.value=true;runCatching { requester.requestFocus() } } else showFocus.value=false
            val up=waitForUpOrCancellation()
            up?.let { noteInput(it.uptimeMillis.toDouble()) }
            held=false
            ripple.up(up?.uptimeMillis?.toDouble() ?: input[0])
            if(up!=null) click()
        } }
        .graphicsLayer { shape=shapeAt(tracks.frame);clip=true }
        .drawBehind {
            val shape=shapeAt(tracks.frame);val outline=shape.createOutline(size,layoutDirection,this)
            drawOutline(outline,tracks.fill.presented(tracks.frame))
            if(ring) { val w=3.dp.toPx();clipPath(Path().apply { addOutline(outline) }) { drawOutline(outline,ringColor,style=Stroke(w*2)) } }
            inspectRow(tracks.frame)
        }
        .then(if(model.disabled) Modifier else Modifier.nativeMenuRipple(ripple,ink))
        .drawBehind {
            val o=tracks.layer.presented(tracks.frame);if(o>0) {
                val outline=(layerShape ?: shapeAt(tracks.frame)).createOutline(size,layoutDirection,this)
                drawOutline(outline,layerColor.copy(alpha=layerColor.alpha*o.toFloat())) }
        }
        .drawWithContent { drawContent()
            if(model.divider) drawRect(statusDotColor(palette.divider),Offset(0f,size.height-1.dp.toPx()),Size(size.width,1.dp.toPx())) }) {
        // The state layer's box (it is painted by the row's draw pass, above the ripple).
        if(inspect!=null) Box(Modifier.matchParentSize().inspectAWCNode(inspect,"state-layer","state-layer"))
        NativeMenuRowLayout(m.paddingInline,m.gap,m.height,bottomPad,rtl) {
            if(!model.sub && model.type!="button" && model.checkPosition=="start") ListSymbol(model.checkGlyph,m.checkSize,ink,modifier=Modifier.layoutId(NativeMenuRowChild(8.0,m.checkSize)))
            Box(Modifier.layoutId(NativeMenuRowChild(0.0,(p["leadingIconSize"] as? Number)?.toDouble() ?: m.iconSize,optional=true)).then(if(inspect!=null) Modifier.inspectAWCNode(inspect,"leading-icon","leading-icon") else Modifier),contentAlignment=Alignment.Center) {
                CompositionLocalProvider(androidx.compose.material3.LocalContentColor provides (if(model.selected) ink else second),LocalAWCButtonSlotSize provides m.iconSize.dp) { content?.invoke("leading-icon") } }
            Column(Modifier.layoutId(NativeMenuRowChild(null,naturalHeadline)).then(if(inspect!=null) Modifier.inspectAWCNode(inspect,"content","content") else Modifier)) {
                BasicText(model.headline,Modifier.fillMaxWidth().then(if(inspect!=null) Modifier.inspectAWCNode(inspect,"headline","headline",allowZeroSize=true) else Modifier),
                    style=listTextStyle(m.headlineSize,m.headlineLine,400,0.0,ink).copy(textAlign=androidx.compose.ui.text.style.TextAlign.Start),maxLines=1,softWrap=false,overflow=TextOverflow.Ellipsis)
                if(model.supportingText.isNotEmpty()) BasicText(model.supportingText,Modifier.fillMaxWidth().then(if(inspect!=null) Modifier.inspectAWCNode(inspect,"supporting-text","supporting-text") else Modifier),
                    style=listTextStyle(m.supportingSize,m.supportingLine,400,0.0,if(model.selected) ink else second),maxLines=1,softWrap=false,overflow=TextOverflow.Ellipsis)
            }
            if(model.badge.isNotEmpty()) { val bw=16+NativeMenuText.width(ctx,badgeText,11.0,500,.5)
                Box(Modifier.layoutId(NativeMenuRowChild(if(model.sub) 0.0 else 12.0,bw)).size(bw.dp,20.dp).background(statusDotColor(palette.badgeFill),AWCCornerShape.uniform(10.0))
                    .then(if(inspect!=null) Modifier.inspectAWCNode(inspect,"badge","badge") else Modifier),contentAlignment=Alignment.Center) {
                    BasicText(badgeText,style=listTextStyle(11.0,16.0,500,.5,statusDotColor(palette.badgeInk)),maxLines=1,softWrap=false) } }
            if(!model.sub) Box(Modifier.layoutId(NativeMenuRowChild(8.0,m.iconSize,optional=true)).then(if(inspect!=null) Modifier.inspectAWCNode(inspect,"trailing","trailing") else Modifier),contentAlignment=Alignment.Center) {
                CompositionLocalProvider(androidx.compose.material3.LocalContentColor provides (if(model.selected) ink else second),LocalAWCButtonSlotSize provides m.iconSize.dp) { content?.invoke("trailing-icon") } }
            // The trailing text is the fallback content of the trailing-icon slot.
            if(!model.sub && model.trailingText.isNotEmpty()) { val tw=NativeMenuText.width(ctx,model.trailingText,11.0,400)
                BasicText(model.trailingText,Modifier.layoutId(NativeMenuRowChild(8.0,tw,fallback=true)).then(if(inspect!=null) Modifier.inspectAWCNode(inspect,"trailing","trailing") else Modifier),
                    style=listTextStyle(11.0,14.0,400,0.0,if(model.selected) ink else second),maxLines=1,softWrap=false) }
            if(model.sub) { val rot by androidx.compose.animation.core.animateFloatAsState(if(subOpen) 90f else 0f,if(reduced) androidx.compose.animation.core.snap() else androidx.compose.animation.core.tween(100,easing=androidx.compose.animation.core.CubicBezierEasing(.2f,0f,0f,1f)),label="caret")
                ListSymbol("arrow_right",m.iconSize,if(model.selected) ink else second,modifier=Modifier.layoutId(NativeMenuRowChild(0.0,m.iconSize)).graphicsLayer { rotationZ=rot;scaleX=if(rtl) -1f else 1f }) }
            if(!model.sub && model.type!="button" && model.checkPosition=="end") ListSymbol(model.checkGlyph,m.checkSize,ink,modifier=Modifier.layoutId(NativeMenuRowChild(8.0,m.checkSize)))
        }
    }
    // The flyout (slot="submenu") is a nested md-menu presented in the scope's top layer.
    if(model.sub) CompositionLocalProvider(LocalNativeMenuFlyoutHost provides NativeMenuFlyoutHost(id,{ rowRect[0] },subOpen),LocalNativeMenuItemContext provides null,LocalNativeMenuSlot provides null,LocalNativeMenuSlots provides null) {
        Box(Modifier.size(0.dp)) { content?.invoke("submenu") }
    }
}
private fun nativeMenuEmit(onEvent:EventSink,inspection:AWCMenuInspection?,controller:NativeMenuController?,id:String,name:String) {
    inspection?.events?.add(Triple(name,id,controller?.registry?.inputTime ?: Double.NaN));onEvent(name,null)
}

/** Layout data of a row child: margin-inline-start (null = the flexible content) and its exact max-content width (dp). */
internal data class NativeMenuRowChild(val margin:Double?,val natural:Double,val optional:Boolean=false,val fallback:Boolean=false)
/** Flex row of md-menu-item / md-sub-menu-item: fixed children keep their width (plus margin-inline-start), the content
 *  column takes the rest (min-width 0, ellipsis). Laid out physically (RTL mirrors the order). */
@Composable private fun NativeMenuRowLayout(padding:Double,gap:Double,minHeight:Double,bottomPad:Double,rtl:Boolean,content:@Composable ()->Unit) {
    val density=LocalDensity.current.density
    Layout(content,measurePolicy=object:MeasurePolicy {
        fun data(m:IntrinsicMeasurable)=(m.parentData as? LayoutIdParentData)?.layoutId as? NativeMenuRowChild ?: NativeMenuRowChild(0.0,0.0)
        /** An optional slot box takes part only when something is slotted; the fallback text only when nothing is. */
        fun present(ms:List<IntrinsicMeasurable>):List<Boolean> {
            val slotted=ms.map { data(it).optional && it.maxIntrinsicWidth(Constraints.Infinity)>0 }
            return ms.mapIndexed { i,m-> val d=data(m);when { d.optional->slotted[i];d.fallback->ms.indices.none { j-> slotted[j] && data(ms[j]).margin==d.margin && j<i };else->true } }
        }
        fun naturalWidth(ms:List<IntrinsicMeasurable>,on:List<Boolean>):Double { val shown=ms.filterIndexed { i,_-> on[i] }
            return padding*2+shown.sumOf { data(it).natural+(data(it).margin ?: 0.0) }+gap*max(0,shown.size-1) }
        override fun IntrinsicMeasureScope.maxIntrinsicWidth(measurables:List<IntrinsicMeasurable>,height:Int)=ceil(naturalWidth(measurables,present(measurables))*density-.01).toInt()
        override fun IntrinsicMeasureScope.minIntrinsicWidth(measurables:List<IntrinsicMeasurable>,height:Int)=maxIntrinsicWidth(measurables,height)
        override fun MeasureScope.measure(measurables:List<Measurable>,constraints:Constraints):MeasureResult {
            val on=present(measurables)
            val width=if(constraints.hasBoundedWidth) constraints.maxWidth/density.toDouble() else naturalWidth(measurables,on)
            val shown=measurables.indices.filter { on[it] }
            val fixed=shown.map { measurables[it] }.filter { data(it).margin!=null }.sumOf { data(it).natural+data(it).margin!! }
            val contentW=max(0.0,width-padding*2-fixed-gap*max(0,shown.size-1))
            val ps=measurables.mapIndexed { i,mm-> val d=data(mm)
                if(!on[i]) mm.measure(Constraints.fixed(0,0)) else {
                    val w=if(d.margin==null) contentW else d.natural
                    // Never ellipsize text for a rounding difference: the box may extend into the gap by under a pixel.
                    val px=if(d.margin==null && contentW+.5/density>=d.natural) max((w*density).roundToInt(),ceil(d.natural*density-.01).toInt()) else (w*density).roundToInt()
                    mm.measure(Constraints(px,px,0,Constraints.Infinity)) } }
            val bp=(bottomPad*density).roundToInt()
            val h=max((minHeight*density).roundToInt(),(shown.maxOfOrNull { ps[it].height } ?: 0)+bp)
            val boxH=h-bp
            return layout((width*density).roundToInt(),h) {
                var x=padding
                measurables.forEachIndexed { i,mm-> if(!on[i]) { ps[i].place(0,0);return@forEachIndexed }
                    val d=data(mm);x+=d.margin ?: 0.0
                    val cw=if(d.margin==null) contentW else d.natural
                    val px=if(rtl) width-x-cw else x
                    ps[i].place((px*density).roundToInt(),(boxH-ps[i].height)/2)
                    x+=cw+gap }
            }
        }
    })
}

// MARK: - md-menu-item-group

@Composable internal fun NativeMenuGroup(p:Props,content:Slot?) {
    val c=LocalNativeMenuItemContext.current ?: NativeMenuItemContext()
    val slot=LocalNativeMenuSlot.current
    val tokens=LocalAWCThemeTokens.current
    val inheritedRung=LocalAWCNativeDensity.current
    val collector=LocalNativeMenuCollector.current
    val palette=NativeMenuPalette(tokens)
    val density=(p["density"] as? Number)?.toDouble()
    val rung=density?.takeIf { it<=-2 } ?: (if(inheritedRung<=-2) inheritedRung else 0.0)
    val sp=NativeMenuSpacing(rung);val label=p.str("label")
    val card=c.gapCard && c.variant!="baseline"
    val slots=remember { NativeMenuSlots() }
    val id=p.str("id")
    val inspect=remember(collector,id) { if(id.isEmpty()) null else collector?.let { AWCInspectionContext(it,id,true,null) } }
    val shape=AWCCornerShape.uniform(c.groupShape)
    val inspection=LocalAWCMenuInspection.current
    SideEffect { if(id.isNotEmpty()) inspection?.rows?.set(id,mapOf("role" to "group","label" to label)) }
    CompositionLocalProvider(LocalAWCNativeDensity provides resolveAWCDensity(density,inheritedRung)) {
    Column(Modifier.then(if(inspect!=null) Modifier.inspectAWCNode(inspect,"","md-menu-item-group") else Modifier)
        .semantics { isTraversalGroup=true;if(label.isNotEmpty()) contentDescription=label }) {
        Column(Modifier.then(if(card && slots.hasSub) Modifier.accordionShadow(shape,NativeMenuPalette.groupShadow,false) else if(card) Modifier.accordionShadow(shape,NativeMenuPalette.groupShadow,false) else Modifier)
            .then(if(card) Modifier.background(statusDotColor(palette.surface(c.variant)),shape) else Modifier)
            .padding(if(card) sp.insetXS.dp else 0.dp)) {
            // The label is the group's name (its container's description): read once, not again as text.
            if(label.isNotEmpty()) BasicText(label,Modifier.clearAndSetSemantics {}.fillMaxWidth().padding(top=sp.insetSM.dp,bottom=sp.insetXS.dp,start=sp.insetMD.dp,end=sp.insetMD.dp),
                style=listTextStyle(12.0,16.0,500,0.0,statusDotColor(palette.groupLabel)),maxLines=1,softWrap=false)
            CompositionLocalProvider(LocalNativeMenuItemContext provides c.copy(directChild=false,inGroup=true,radioScope=id.ifEmpty { "group" }),LocalNativeMenuSlots provides slots) {
                NativeMenuColumn(0.0,0.0,slots) { content?.invoke("") }
            }
        }
        if(slot?.last!=true && !c.gapCard) Box(Modifier.fillMaxWidth().padding(vertical=sp.gapXS.dp).height(1.dp).background(statusDotColor(palette.divider)))
    }
    }
}
