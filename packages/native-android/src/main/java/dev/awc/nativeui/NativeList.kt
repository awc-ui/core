@file:OptIn(androidx.compose.ui.text.ExperimentalTextApi::class)
package dev.awc.nativeui

import androidx.compose.foundation.Image
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.waitForUpOrCancellation
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.PressInteraction
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.material3.LocalTextStyle
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.focus.*
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.RoundRect
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.*
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.input.key.*
import androidx.compose.ui.input.pointer.PointerEventType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.*
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.*
import androidx.compose.ui.text.font.*
import androidx.compose.ui.text.style.LineHeightStyle
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.*
import androidx.compose.ui.zIndex
import kotlinx.coroutines.launch
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.roundToInt

// MARK: Rows, registry and the list runtime

/** One md-list-item as its owner sees it (identity survives recomposition). */
@Stable internal class NativeListRow {
    var props by mutableStateOf<Props>(emptyMap())
    var y=Float.NaN;var h=0f
    var index by mutableIntStateOf(-1)
    /** Bumped when a reorder re-inserts the row (its transitions restart from rest). */
    var generation by mutableIntStateOf(0)
    var selected by mutableStateOf(false)
    var selectedSeed:Any?=Unit
    var expanded by mutableStateOf(false)
    var expandedSeed:Any?=Unit
    var focusable by mutableStateOf(false)
    var expandable by mutableStateOf(false)
    var hidden by mutableStateOf(false)
    var label by mutableStateOf("")
    val requester=FocusRequester()
    var focused by mutableStateOf(false)
    var showFocus by mutableStateOf(true)
    var pending=false
    val panel=NativeListRegistry()
    var toggle:()->Unit={}
    var setExpanded:((Boolean?)->Unit)?=null
    var activateByKey:()->Unit={}
    val id get()=props.str("id")
    /** Moves keyboard focus to the row; false when it cannot take focus. */
    fun focus(visible:Boolean):Boolean { if(!focusable || hidden) return false
        showFocus=visible;if(focused) return true;pending=true
        val ok=runCatching { requester.requestFocus();true }.getOrDefault(false);if(focused || !ok) pending=false;return ok }
}
/** Rows in document order: the order rendered (top to bottom), hidden rows included. */
@Stable internal class NativeListRegistry {
    private val rows=mutableListOf<NativeListRow>()
    var order by mutableStateOf<List<NativeListRow>>(emptyList())
    fun register(row:NativeListRow) { if(row !in rows) { rows+=row;resort() } }
    fun unregister(row:NativeListRow) { rows-=row;resort() }
    fun place(row:NativeListRow,y:Float,h:Float) { if(row.y==y && row.h==h) return;row.y=y;row.h=h;resort() }
    fun resort() {
        val sorted=rows.sortedWith(compareBy<NativeListRow>({ if(it.y.isNaN()) Float.MAX_VALUE else it.y },{ if(it.h>0f) 1 else 0 }))
        if(sorted!=order) order=sorted
        sorted.forEachIndexed { i,r-> if(r.index!=i) r.index=i }
    }
    val placed get()=order.isNotEmpty() && order.none { it.y.isNaN() }
}
/** Roving focus, selection and disclosure owned by one md-list. */
@Stable internal class NativeListOwner {
    val registry=NativeListRegistry()
    var props by mutableStateOf<Props>(emptyMap())
    var emit:EventSink={ _,_-> }
    var inspection:AWCListInspection?=null
    /** Frame-clock time (ms) of the latest input handled by any row: CSS transitions start at the input's frame. */
    var inputTime=Double.NaN
    var inputIsKey=false
    var active by mutableStateOf<NativeListRow?>(null)
    var rovingVisible by mutableStateOf<NativeListRow?>(null)
    private var typeahead="";private var typeaheadTime=0L
    val selectionMode get()=props.str("selectionMode").takeIf { it=="single-select" || it=="multi-select" } ?: "none"
    val focusableRows get()=rows.filter { it.focusable && !it.hidden }
    val effectiveActive:NativeListRow? get() { val rows=focusableRows;active?.let { if(it in rows) return it };return rows.firstOrNull { it.selected } ?: rows.firstOrNull() }
    fun send(name:String,detail:AWCValue) { inspection?.events?.add(name to detail);emit(name,detail) }
    // MARK: reorder (the source moves light-DOM rows; natively the list keeps the displayed order)
    var display by mutableStateOf<List<NativeListRow>?>(null)
    var reorderable=false
    var density=1f
    var listTop=0f
    /** Rows in displayed order (authored order until a reorder; reset when the authored rows change). */
    val rows:List<NativeListRow> get() { val auth=registry.order;val d=display
        return if(d!=null && d.size==auth.size && d.toSet()==auth.toSet()) d else auth }
    fun indexOf(row:NativeListRow)=rows.indexOf(row)
    /** Layout offset (px) of each row from its authored slot to its displayed slot (dividers keep their slots). */
    fun displayOffset(row:NativeListRow):Float {
        val d=display ?: return 0f;val auth=registry.order
        if(d.size!=auth.size || d.toSet()!=auth.toSet()) return 0f
        var y=auth.first().y
        for(k in d.indices) { val r=d[k];if(r===row) return y-row.y
            val gap=if(k+1<auth.size) auth[k+1].y-(auth[k].y+auth[k].h) else 0f;y+=r.h+gap }
        return 0f
    }
    var dragRow by mutableStateOf<NativeListRow?>(null)
    var dragDelta by mutableFloatStateOf(0f)
    var dragTarget by mutableIntStateOf(0)
    var placeholder by mutableStateOf<Pair<Float,Float>?>(null)
    private var rects:List<Triple<NativeListRow,Float,Float>> = emptyList()
    private var dragFrom=0;private var dragStart=0f;private var rowGap=0f
    val snapNext=mutableSetOf<NativeListRow>()
    fun beginDrag(row:NativeListRow,rootY:Float):Boolean {
        val list=rows;val from=list.indexOf(row)
        if(!reorderable || dragRow!=null || from<0 || row.props.bool("disabled")) return false
        rects=list.map { Triple(it,it.y+displayOffset(it),it.h) }
        rowGap=if(rects.size>1) rects[1].second-rects[0].second else rects.firstOrNull()?.third ?: 0f
        dragFrom=from;dragTarget=from;dragStart=rootY;dragDelta=0f;dragRow=row
        placeholder=(rects[from].second-listTop) to rects[from].third
        return true
    }
    fun moveDrag(rootY:Float) {
        if(dragRow==null) return
        dragDelta=rootY-dragStart
        val center=rects[dragFrom].second+rects[dragFrom].third/2+dragDelta
        var target=dragFrom
        rects.forEachIndexed { i,r-> if(i!=dragFrom) { val c=r.second+r.third/2
            if(i<dragFrom && center<c) target=minOf(target,i);if(i>dragFrom && center>c) target=maxOf(target,i) } }
        if(target!=dragTarget) { dragTarget=target;placeholder=(rects[target].second-listTop) to rects[dragFrom].third }
    }
    /** applySiblingShifts (px). */
    fun shift(row:NativeListRow):Float {
        if(dragRow==null || row===dragRow) return 0f
        val i=rects.indexOfFirst { it.first===row };if(i<0) return 0f
        if(dragFrom<dragTarget && i>dragFrom && i<=dragTarget) return -rowGap
        if(dragFrom>dragTarget && i<dragFrom && i>=dragTarget) return rowGap
        return 0f
    }
    fun endDrag():Boolean {
        val row=dragRow ?: return false;val from=dragFrom;val to=dragTarget
        dragRow=null;dragDelta=0f;placeholder=null;rects=emptyList()
        if(to!=from) { snapNext+=row;row.generation++;moveItem(from,to);return true }
        return false
    }
    fun keyReorder(row:NativeListRow,up:Boolean):Boolean {
        if(!reorderable) return false
        val from=rows.indexOf(row);if(from<0) return false
        val to=if(up) from-1 else from+1
        if(to<0 || to>=rows.size || row.props.bool("disabled")) return true
        snapNext+=row;row.generation++;moveItem(from,to);return true
    }
    private fun moveItem(from:Int,to:Int) {
        val list=rows.toMutableList();val moving=list.removeAt(from);list.add(to,moving);display=list
        val auth=registry.order
        send("mdReorder",mapOf("from" to from,"to" to to,"order" to list.map { auth.indexOf(it) }))
    }
    // MARK: methods
    fun step(d:Int):String? { val ids=focusableRows;if(ids.isEmpty()) return null
        val cur=effectiveActive?.let { ids.indexOf(it) } ?: -1
        val next=if(d>0) (if(cur<ids.size-1) cur+1 else 0) else (if(cur>0) cur-1 else ids.size-1)
        focus(ids[next],true);return ids[next].id }
    fun selectSilently(index:Int) { val list=rows;if(selectionMode=="none" || index !in list.indices || list[index].expandable) return
        val row=list[index];if(selectionMode=="single-select") { list.forEach { if(it!==row) it.selected=false };row.selected=true } else row.selected=!row.selected }
    fun selectedIndices()=rows.mapIndexedNotNull { i,r-> if(r.selected) i else null }
    /** Focus landed on [row] (pointer press, keyboard or method): `mdActivate` only on a change. */
    fun activate(row:NativeListRow,emit:Boolean=true) {
        val index=rows.indexOf(row);if(index<0) return
        val changed=effectiveActive!==row
        active=row;rovingVisible=null
        if(changed && emit) send("mdActivate",mapOf("index" to index,"item" to row.id))
    }
    /** List `activateItem(index, fromUserAction)` after a row click. */
    fun itemClicked(row:NativeListRow) {
        val index=rows.indexOf(row);if(index<0 || row.expandable) return
        when(selectionMode) {
            "single-select"->{ rows.forEach { if(it!==row && it.selected) it.selected=false };row.selected=true
                send("mdSelect",mapOf("index" to index,"value" to row.label,"selected" to true,"item" to row.id)) }
            "multi-select"->{ row.selected=!row.selected
                send("mdSelect",mapOf("index" to index,"value" to row.label,"selected" to row.selected,"item" to row.id)) }
        }
    }
    /** A row in an expandable parent's panel: the list reports the parent index. */
    fun childClicked(parent:NativeListRow,child:NativeListRow) {
        if(selectionMode=="none") return
        val index=rows.indexOf(parent);if(index<0) return
        val siblings=parent.panel.order
        if(selectionMode=="single-select") { siblings.forEach { if(it!==child) it.selected=false };child.selected=true } else child.selected=!child.selected
        send("mdSelect",mapOf("index" to index,"childIndex" to siblings.indexOf(child).coerceAtLeast(0),"expanded" to parent.expanded,"value" to child.label,
            "selected" to child.selected,"item" to child.id))
    }
    fun move(key:String,from:NativeListRow):Boolean {
        val rows=focusableRows;if(rows.isEmpty()) return false
        val at=rows.indexOf(from).coerceAtLeast(0)
        val target=when(key) { "ArrowDown"->rows[(at+1)%rows.size];"ArrowUp"->rows[(at-1+rows.size)%rows.size];"Home"->rows[0];"End"->rows[rows.size-1];else->return false }
        focus(target,true);return true
    }
    fun focus(row:NativeListRow,visible:Boolean) { activate(row);row.focus(visible) }
    fun typeaheadKey(ch:Char,from:NativeListRow,now:Long):Boolean {
        if(!ch.isLetterOrDigit()) return false
        typeahead=if(now-typeaheadTime>500) ch.lowercase() else typeahead+ch.lowercase();typeaheadTime=now
        val rows=focusableRows;if(rows.isEmpty()) return true
        val at=rows.indexOf(from).coerceAtLeast(0)
        val order=if(typeahead.length==1) rows.drop(at+1)+rows.take(at+1) else rows.drop(at)+rows.take(at)
        order.firstOrNull { it.label.lowercase().startsWith(typeahead) }?.let { focus(it,true) }
        return true
    }
}
internal class NativeListPanelScope(val parent:NativeListRow,val parentContext:NativeListItemContext?,val owner:NativeListOwner?,val onChildClick:(NativeListRow)->Unit,
                                    val inspection:AWCInspectionContext?=null)
internal val LocalNativeListOwner=staticCompositionLocalOf<NativeListOwner?> { null }
internal val LocalNativeListPanel=staticCompositionLocalOf<NativeListPanelScope?> { null }
internal val LocalNativeListRung=staticCompositionLocalOf<Double?> { null }
internal val LocalNativeListInspectionContext=staticCompositionLocalOf<AWCInspectionContext?> { null }
/** Slotted-content facts an item needs (a `<video>` in leading). */
internal class NativeListItemSlots { var video by mutableStateOf(false) }
internal val LocalNativeListItemSlots=staticCompositionLocalOf<NativeListItemSlots?> { null }
/** The row's resolved hooks (inherited + inline), for slotted content sized by item hooks. */
internal val LocalNativeListItemResolved=staticCompositionLocalOf<AWCListItemAppearance?> { null }

/** A leading `<video>` (or any moving media) slotted into a row: sized by the leading-video hooks. */
@Composable fun AWCListLeadingVideo(modifier:Modifier=Modifier,content:@Composable BoxScope.()->Unit={}) {
    val slots=LocalNativeListItemSlots.current
    DisposableEffect(slots) { slots?.video=true;onDispose { slots?.video=false } }
    val a=LocalNativeListItemResolved.current ?: LocalAWCListItemAppearance.current
    Box(modifier.size((a.leadingVideoWidth ?: 100.0).dp,(a.leadingVideoHeight ?: 56.0).dp).clip(AWCCornerShape.uniform(a.leadingVideoShape ?: 8.0)),content=content)
}

// MARK: md-list

internal data class NativeListModel(val p:Props) {
    val listStyle=if(p.str("listStyle")=="segmented") "segmented" else "standard"
    val selectionMode=p.str("selectionMode").takeIf { it=="single-select" || it=="multi-select" } ?: "none"
    val interactionMode=if(p.str("interactionMode")=="multi-action") "multi-action" else "single-action"
    val reorderable=p.bool("reorderable");val label=p.str("label");val roleOverride=p.str("roleOverride")
    val density=(p["density"] as? Number)?.toDouble()?.takeIf { it!=0.0 }
    fun role(expandableRows:Boolean)=roleOverride.ifEmpty { if(selectionMode!="none" && !expandableRows) "listbox" else "list" }
}

@Composable internal fun NativeList(p:Props,onEvent:EventSink,content:Slot?) {
    val owner=remember { NativeListOwner() }
    val model=NativeListModel(p)
    val a=LocalAWCListAppearance.current
    val inspection=LocalAWCListInspection.current
    val scale=LocalAWCNativeDensity.current
    val local=model.density
    val rung=when { local!=null && local<=-2->local;local==null && scale<=-2->scale;else->LocalNativeListRung.current ?: 0.0 }
    SideEffect { owner.props=p;owner.emit=onEvent;owner.inspection=inspection }
    val segmented=model.listStyle=="segmented"
    val padBlock=a.paddingBlock ?: if(segmented) 0.0 else if(rung<=-3) 4.0 else 8.0
    val padInline=a.paddingInline ?: 0.0
    val gap=if(segmented) a.segmentedGap ?: 2.0 else 0.0
    val shape=a.containerShape ?: AWCCornerShape.uniform(0.0)
    val background=statusDotColor(a.containerColor ?: "#00000000")
    val order=owner.registry.order
    val role=model.role(order.any { it.expandable })
    val id=p.str("id").ifEmpty { "list" }
    SideEffect { inspection?.lists?.set(id,mapOf("padding" to listOf(padBlock,padInline),"gap" to gap,"role" to role,"active" to (owner.effectiveActive?.id ?: ""),
        "selection" to order.filter { it.selected }.map { it.id })) }
    val listContext=LocalAWCInspection.current
    val phTrack=remember { AWCCSSValueTrack(0.0) { a,b,t-> a+(b-a)*t } }
    var phFrame by remember { mutableDoubleStateOf(0.0) }
    var phPrimed by remember { mutableStateOf(false) }
    val ph=owner.placeholder
    val reducedList=LocalAWCListReducedMotion.current ?: !android.animation.ValueAnimator.areAnimatorsEnabled()
    val tokens=LocalAWCThemeTokens.current
    val phPart=LocalAWCListPlaceholderPart.current
    val listControllers=LocalAWCListControllers.current
    SideEffect { owner.reorderable=model.reorderable;listControllers[id]?.owner=owner }
    LaunchedEffect(ph?.first) {
        val top=ph?.first ?: run { phPrimed=false;return@LaunchedEffect }
        val now=withFrameNanos { it }/1e6
        if(!phPrimed) { phTrack.snap(top.toDouble());phPrimed=true;phFrame=now;return@LaunchedEffect }
        phTrack.set(top.toDouble(),now,if(reducedList) 0.0 else 200.0,accordionCSSCubicBezier(tokens["--md-sys-motion-easing-standard"]) ?: listOf(.2,0.0,0.0,1.0))
        phFrame=now;while(phTrack.isRunning(phFrame)) phFrame=withFrameNanos { it }/1e6
    }
    Layout(content={
        CompositionLocalProvider(LocalNativeListOwner provides owner,LocalNativeListPanel provides null,LocalNativeListRung provides rung,
            LocalNativeListInspectionContext provides listContext) { content?.invoke("") }
    },modifier=Modifier.fillMaxWidth().onGloballyPositioned { owner.listTop=it.positionInRoot().y }.background(background,shape)  // overflow: visible (the lifted row's shadow)
        .drawBehind { val p=owner.placeholder ?: return@drawBehind
            val top=phTrack.presented(phFrame).toFloat();val inset=(padInline*density).toFloat();val w=((phPart?.borderWidth ?: a.dropPlaceholderOutlineWidth ?: 2.0)*density).toFloat()
            val phShape=a.dropPlaceholderShape ?: AWCCornerShape.uniform(16.0)
            val alpha=(phPart?.opacity ?: a.dropPlaceholderOpacity ?: 1.0).toFloat()
            val fill=statusDotColor(phPart?.backgroundColor ?: a.dropPlaceholderColor ?: NativeListItemStyle.mix(tokens["--md-sys-color-primary-container"] ?: "#EADDFF",.45))
            val outline=statusDotColor(phPart?.borderColor ?: a.dropPlaceholderOutlineColor ?: NativeListItemStyle.mix(tokens["--md-sys-color-primary"] ?: "#6750A4",.55))
            translate(inset,top) { val sz=Size(size.width-2*inset,p.second);val o=phShape.createOutline(sz,layoutDirection,this)
                drawOutline(o,fill.copy(alpha=fill.alpha*alpha))
                clipPath(Path().apply { addOutline(o) }) { drawOutline(o,outline.copy(alpha=outline.alpha*alpha),style=Stroke(w*2,pathEffect=PathEffect.dashPathEffect(floatArrayOf(w*3,w*3)))) } }
            inspection?.lists?.set("$id.placeholder",mapOf("top" to top/density,"height" to p.second/density)) }
        .padding(horizontal=padInline.dp,vertical=padBlock.dp)
        .semantics { if(model.label.isNotEmpty()) contentDescription=model.label;if(role=="listbox") selectableGroup()
            collectionInfo=CollectionInfo(order.size,1) }) { measurables,constraints->
        val gapPx=(gap*density).roundToInt()
        val placeables=measurables.map { it.measure(constraints.copy(minHeight=0,maxHeight=Constraints.Infinity)) }
        var y=0;val ys=IntArray(placeables.size);var any=false
        placeables.forEachIndexed { i,pl-> if(pl.height>0) { if(any) y+=gapPx;any=true };ys[i]=y;y+=pl.height }
        // z-index 1 of the dragged row: the child laid out at the dragged row's authored slot.
        val raised=owner.dragRow?.let { it.y-owner.listTop-(padBlock*density).toFloat() }
        layout(constraints.maxWidth,constraints.constrainHeight(y)) { placeables.forEachIndexed { i,pl-> pl.placeRelative(0,ys[i],if(raised!=null && abs(ys[i]-raised)<1f) 1f else 0f) } }
    }
}
private fun Modifier.background(color:Color,shape:Shape)=drawBehind { if(color.alpha>0f) drawOutline(shape.createOutline(size,layoutDirection,this),color) }

// MARK: md-list-item

private val ListRoboto=FontFamily(Font(R.font.awc_roboto_regular,FontWeight.Normal),Font(R.font.awc_roboto_medium,FontWeight.Medium),Font(R.font.awc_roboto_bold,FontWeight.Bold))
internal fun listTextStyle(size:Double,lineHeight:Double,weight:Int,tracking:Double,color:Color,family:String?=null):TextStyle {
    val f=family?.lowercase()
    val ff=when { f==null->ListRoboto;f.contains("monospace")->FontFamily.Monospace;f.contains("serif") && !f.contains("sans")->FontFamily.Serif;else->ListRoboto }
    return TextStyle(color=color,fontSize=size.sp,lineHeight=lineHeight.sp,fontFamily=ff,fontWeight=FontWeight(weight),letterSpacing=tracking.sp,
        platformStyle=PlatformTextStyle(includeFontPadding=false),lineHeightStyle=LineHeightStyle(LineHeightStyle.Alignment.Center,LineHeightStyle.Trim.None,LineHeightStyle.Mode.Fixed))
}
@Composable private fun ListText(text:String,style:TextStyle,modifier:Modifier=Modifier,lines:Int=1,onOverflow:((Boolean)->Unit)?=null) {
    BasicText(text,modifier,style=style,maxLines=lines,overflow=TextOverflow.Ellipsis,softWrap=lines>1,onTextLayout={ r-> onOverflow?.invoke(r.hasVisualOverflow) })
}
/** Clipped headline / supporting text (the source's scroll vs client size check on each text span). */
@Stable internal class NativeListTruncation { var headline by mutableStateOf(false);var supporting by mutableStateOf(false) }
/** The source wraps the headline and supporting text in a stable md-tooltip enabled only while the text is clipped;
 *  the shared md-tooltip renderer supplies the popup, delays and description (inside an AWCTooltipScope). */
@Composable private fun ListTruncationTooltip(text:String,enabled:Boolean,content:@Composable ()->Unit) {
    if(LocalNativeTooltipRegistry.current==null) { content();return }
    CompositionLocalProvider(LocalAWCSlots provides null,LocalAWCInspection provides null,LocalAWCTooltipController provides null) {
        NativeTooltip(mapOf("text" to text,"disabled" to !enabled),{ _,_-> }) { name-> if(name.isEmpty()) content() }
    }
}
@Composable internal fun ListSymbol(name:String,size:Double,color:Color,fill:Double=0.0,glyphSize:Double?=null,modifier:Modifier=Modifier) {
    val fillStep=(fill.coerceIn(0.0,1.0)*50).roundToInt()/50f
    val family=remember(fillStep) { FontFamily(Font(R.font.awc_material_symbols,FontWeight(400),
        variationSettings=FontVariation.Settings(FontVariation.Setting("FILL",fillStep),FontVariation.weight(400),FontVariation.Setting("opsz",24f),FontVariation.grade(0)))) }
    val fontSize=with(LocalDensity.current) { (glyphSize ?: size).dp.toSp() }
    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
        Box(modifier.size(size.dp).clearAndSetSemantics { },contentAlignment=Alignment.Center) {
            BasicText(name,Modifier.wrapContentSize(unbounded=true),style=TextStyle(color=color,fontFamily=family,fontWeight=FontWeight(400),fontSize=fontSize,lineHeight=fontSize,
                letterSpacing=0.sp,platformStyle=PlatformTextStyle(includeFontPadding=false),fontFeatureSettings="liga"),maxLines=1,softWrap=false)
        }
    }
}
@Composable private fun ListImage(source:String,modifier:Modifier) {
    val bitmap=remember(source) { if(source.startsWith("data:")) runCatching { val b=android.util.Base64.decode(source.substringAfter(','),android.util.Base64.DEFAULT)
        android.graphics.BitmapFactory.decodeByteArray(b,0,b.size)?.asImageBitmap() }.getOrNull() else null }
    if(bitmap!=null) Image(bitmap,null,modifier,contentScale=ContentScale.Crop,filterQuality=FilterQuality.None) else Box(modifier)
}

private data class ListTargets(val corners:List<Double>,val layer:Double,val active:Boolean,val expanded:Boolean,val placed:Boolean,
                               val shift:Double,val lifting:Boolean,val dragged:Boolean,val handle:List<Double>)
/** CSS transitions of one row on the frame clock. */
@Stable private class NativeListTracks {
    val corners=List(4) { AWCCSSValueTrack(0.0) { a,b,t-> a+(b-a)*t } }
    val layer=AWCCSSValueTrack(0.0) { a,b,t-> a+(b-a)*t }
    val panel=AWCCSSValueTrack(0.0) { a,b,t-> a+(b-a)*t }
    val inner=AWCCSSValueTrack(0.0) { a,b,t-> a+(b-a)*t }
    val caret=AWCCSSValueTrack(0.0) { a,b,t-> a+(b-a)*t }
    val shift=AWCCSSValueTrack(0.0) { a,b,t-> a+(b-a)*t }
    val lift=AWCCSSValueTrack(0.0) { a,b,t-> a+(b-a)*t }
    val handle=List(3) { AWCCSSValueTrack(0.0) { a,b,t-> a+(b-a)*t } }
    var frame by mutableDoubleStateOf(0.0)
    var primed=false
    fun running(now:Double)=corners.any { it.isRunning(now) } || layer.isRunning(now) || panel.isRunning(now) || inner.isRunning(now) || caret.isRunning(now)
        || shift.isRunning(now) || lift.isRunning(now) || handle.any { it.isRunning(now) }
}

@Composable internal fun NativeListItem(p:Props,onEvent:EventSink,content:Slot?) {
    val owner=LocalNativeListOwner.current
    val panelScope=LocalNativeListPanel.current
    val registry=panelScope?.parent?.panel ?: owner?.registry
    val row=remember { NativeListRow() }
    DisposableEffect(registry) { registry?.register(row);onDispose { registry?.unregister(row) } }
    val model=NativeListItemModel(p)
    if(row.selectedSeed!=p["selected"]) { row.selectedSeed=p["selected"];row.selected=model.selected }
    if(row.expandedSeed!=p["expanded"]) { row.expandedSeed=p["expanded"];row.expanded=model.expanded }
    SideEffect { row.props=p }
    val slots=remember { NativeListItemSlots() }
    val overlineText=remember { AWCSlotTextRegistry() };val supportingText=remember { AWCSlotTextRegistry() };val defaultText=remember { AWCSlotTextRegistry() }
    val inline=LocalAWCListItemAppearanceTargets.current[model.id] ?: AWCListItemAppearance()
    val inherited=LocalAWCListItemAppearance.current
    val parts=LocalAWCListItemParts.current
    val tokens=LocalAWCThemeTokens.current
    val rtl=LocalLayoutDirection.current==LayoutDirection.Rtl
    val scale=LocalAWCNativeDensity.current
    val listRung=LocalNativeListRung.current
    val rung=if((model.density ?: 0.0)<=-2) model.density!! else listRung ?: (if(scale<=-2) scale else 0.0)
    val morph=LocalAWCListShapeMorph.current
    val reduced=LocalAWCListReducedMotion.current ?: !android.animation.ValueAnimator.areAnimatorsEnabled()
    val listInspection=LocalAWCListInspection.current
    val order=if(panelScope==null && owner!=null) owner.rows else registry?.order ?: emptyList()
    val index=if(panelScope==null && owner!=null) owner.indexOf(row) else row.index
    val ctx:NativeListItemContext?=when {
        panelScope!=null->{ val pc=panelScope.parentContext
            NativeListItemContext(pc?.listStyle ?: "standard",owner?.selectionMode ?: "none",pc?.interactionMode ?: "single-action",pc?.containerRole ?: "list",false,pc?.hostList ?: false,
                index==0,index==order.size-1,pc?.index ?: 0,index,true,(pc?.last ?: false) && pc!=null && index==order.size-1) }
        owner!=null->{ val lm=NativeListModel(owner.props)
            NativeListItemContext(lm.listStyle,lm.selectionMode,lm.interactionMode,lm.role(false),lm.reorderable,true,index==0,index==order.size-1,index) }
        else->null }
    val expanded=model.expandable && row.expanded
    val style=NativeListItemStyle(model,ctx,inline,inherited,tokens,rtl,scale,rung,row.selected,expanded,overlineText.hasEntries,supportingText.hasEntries,slots.video,morph)
    val headlineLabel=model.headline.ifEmpty { awcCollapsedWhitespace(defaultText.text) }
    SideEffect { row.focusable=style.focusable && !model.hidden;row.expandable=model.expandable;row.hidden=model.hidden;row.label=headlineLabel }
    var hovered by remember { mutableStateOf(false) }
    var held by remember { mutableStateOf(false) }
    var keyPressed by remember { mutableStateOf(false) }
    val interactions=remember { MutableInteractionSource() }
    val scope=rememberCoroutineScope()
    val uri=LocalUriHandler.current
    val tracks=remember { NativeListTracks() }
    val input=remember { doubleArrayOf(Double.NaN,0.0) }
    fun noteInput(ms:Long,key:Boolean=false) { input[0]=ms.toDouble();input[1]=if(key) 1.0 else 0.0;owner?.inputTime=ms.toDouble();owner?.inputIsKey=key }
    val densityPx=LocalDensity.current.density
    val frameMs=1000.0/(LocalView.current.display?.refreshRate?.takeIf { it>0f }?.toDouble() ?: 60.0)
    val geometry=remember { NativeListRowGeometry() }
    val truncation=remember { NativeListTruncation() }
    // In a list the row records itself under the list ("list.<id>"); a standalone row is the
    // inspected component itself and only adds its parts.
    val listInspect=LocalNativeListInspectionContext.current;val ownInspect=LocalAWCInspection.current
    // A row in a standalone parent's panel records itself beside its parent.
    val panelInspect=if(listInspect==null) panelScope?.inspection else null
    val inspect=remember(listInspect,ownInspect,panelInspect,model.id) { listInspect?.let { AWCInspectionContext(it.collector,"${it.id}.${model.id.ifEmpty { "item" }}",true,it.id) }
        ?: panelInspect?.let { AWCInspectionContext(it.collector,model.id.ifEmpty { "item" },true,null) } ?: ownInspect }
    if(model.hidden) {
        Box(Modifier.onGloballyPositioned { c-> registry?.place(row,c.positionInRoot().y,0f) })
        return
    }
    val tabbable=if(panelScope!=null) true else owner?.let { it.effectiveActive===row } ?: true
    val roving=(model.rovingFocusVisible || owner?.rovingVisible===row) && !row.focused
    val dragged=owner?.dragRow===row && owner!=null
    var handleHovered by remember { mutableStateOf(false) }
    val dropAt=remember { arrayOfNulls<Offset>(1) };val dropRest=remember { booleanArrayOf(false) }
    // A drop re-slots rows under a still pointer: hover is recomputed from the next pointer event.
    val lifting=owner?.dragRow!=null
    LaunchedEffect(lifting) { if(!lifting) handleHovered=false }
    val states=NativeListItemStates(hover=hovered && style.interactive,active=held && style.interactive,pressed=(held && style.interactive && !style.disabledClass) || keyPressed,
        focusVisible=row.focused && row.showFocus,roving=roving,dragged=dragged)
    val placed=registry==null || (index>=0 && registry.placed)
    val handleTarget=if(dragged) listOf(1.0,1.0,1.0) else if(handleHovered && owner?.dragRow==null) listOf(1.0,1.0,if(reduced) 1.0 else 1.08) else listOf(.55,0.0,1.0)
    val targets=ListTargets(style.corners(states),style.layerOpacity(states),style.stateShape(states)!=null,expanded,placed,
        (if(panelScope==null) owner?.shift(row)?.toDouble() else null) ?: 0.0,owner?.dragRow!=null,dragged,handleTarget)
    LaunchedEffect(targets,reduced,row.generation) {
        val moved=owner?.snapNext?.remove(row)==true
        // A reordered row is re-inserted in the source: it restarts from its resting style (no transitions) and its
        // interactive states (focus, hover) then transition in from there.
        if(moved && tracks.primed && targets.placed) { val rest=NativeListItemStates()
            style.corners(rest).forEachIndexed { i,v-> tracks.corners[i].snap(v) };tracks.layer.snap(style.layerOpacity(rest))
            tracks.shift.snap(targets.shift);tracks.lift.snap(0.0);listOf(.55,0.0,1.0).forEachIndexed { i,v-> tracks.handle[i].snap(v) } }
        else if(!tracks.primed || !targets.placed || moved) {
            targets.corners.forEachIndexed { i,v-> tracks.corners[i].snap(v) };tracks.layer.snap(targets.layer)
            tracks.shift.snap(targets.shift);tracks.lift.snap(if(targets.dragged) 1.0 else 0.0);targets.handle.forEachIndexed { i,v-> tracks.handle[i].snap(v) }
            val e=if(targets.expanded) 1.0 else 0.0;tracks.panel.snap(e);tracks.inner.snap(e);tracks.caret.snap(e)
            tracks.primed=targets.placed;tracks.frame=withFrameNanos { it }/1e6;return@LaunchedEffect
        }
        // CSS starts a transition at the frame that recalculates the style; this effect resumes one frame later.
        val frame=withFrameNanos { it }/1e6
        // The style changed in the frame that handled the input (keys, pointer, focus moves): start there,
        // like a CSS transition; otherwise one frame before this resumed effect.
        val ref=owner?.inputTime ?: input[0]
        val fromInput=!ref.isNaN() && frame-ref>=0 && frame-ref<=4*frameMs
        val now=if(fromInput) ref else frame-frameMs
        // A key restyles in Chrome's next frame; this effect resumes two frames after the key, so this frame
        // already renders the progress since the key.
        val keyDriven=fromInput && (if(owner!=null) owner.inputIsKey else input[1]==1.0)
        val standard=accordionCSSCubicBezier(tokens["--md-sys-motion-easing-standard"]) ?: listOf(.2,0.0,0.0,1.0)
        val decel=accordionCSSCubicBezier(tokens["--md-sys-motion-easing-emphasized-decelerate"]) ?: listOf(.05,.7,.1,1.0)
        val accel=accordionCSSCubicBezier(tokens["--md-sys-motion-easing-emphasized-accelerate"]) ?: listOf(.3,0.0,.8,.15)
        val shapeD=if(reduced) 0.0 else if(targets.active) 200.0 else 400.0
        targets.corners.forEachIndexed { i,v-> tracks.corners[i].set(v,now,shapeD,if(targets.active) standard else decel) }
        tracks.layer.set(targets.layer,now,100.0,standard)
        val open=targets.expanded;val d=if(reduced) 0.0 else if(open) style.a.expandDuration ?: 350.0 else style.a.collapseDuration ?: 200.0
        tracks.panel.set(if(open) 1.0 else 0.0,now,d,if(open) decel else accel);tracks.inner.set(if(open) 1.0 else 0.0,now,d,if(open) decel else accel)
        tracks.caret.set(if(open) 1.0 else 0.0,now,if(reduced) 0.0 else accordionTokenDuration(tokens,"--md-sys-motion-duration-medium2",300.0),standard)
        // Siblings glide (`--shifting`, 200ms) only while a drag runs; the drop clears transforms in one tick.
        tracks.shift.set(targets.shift,now,if(reduced || !targets.lifting) 0.0 else 200.0,standard)
        tracks.lift.set(if(targets.dragged) 1.0 else 0.0,now,100.0,standard)
        targets.handle.forEachIndexed { i,v-> tracks.handle[i].set(v,now,if(reduced) 0.0 else 150.0,standard) }
        // Siblings shifting under a drag follow the pointer move like a key (the source restyles them in its handler).
        val immediate=keyDriven || (fromInput && targets.lifting && !targets.dragged)
        tracks.frame=if(immediate) frame else now
        while(tracks.running(tracks.frame)) tracks.frame=withFrameNanos { it }/1e6
        }
    fun emitItem(name:String,detail:AWCValue) { listInspection?.events?.add(name to detail);onEvent(name,detail) }
    fun toggleExpanded() {
        val next=!row.expanded;row.expanded=next
        emitItem("mdExpand",mapOf("expanded" to next,"index" to (ctx?.index ?: 0),"value" to headlineLabel,"item" to model.id))
    }
    fun click() {
        if(!style.interactive || style.disabledClass) return
        if(panelScope!=null) { emitItem("mdClick",mapOf("item" to model.id));panelScope.onChildClick(row);return }
        if(model.expandable) { toggleExpanded();emitItem("mdClick",mapOf("item" to model.id));return }
        emitItem("mdClick",mapOf("item" to model.id))
        if(model.type=="link" && (model.href.startsWith("https://") || model.href.startsWith("http://"))) runCatching { uri.openUri(model.href) }
        owner?.itemClicked(row)
    }
    fun keyboardActivate() {
        if(!style.interactive || style.disabledClass) return
        keyPressed=true;scope.launch { nativeKeyboardRipple(interactions).join();keyPressed=false }
        click()
    }
    val itemControllers=LocalAWCListItemControllers.current
    SideEffect { row.toggle={ if(model.expandable && !style.disabledClass) toggleExpanded() };row.activateByKey={ keyboardActivate() }
        row.setExpanded={ v-> if(model.expandable && !style.disabledClass) row.expanded=v ?: !row.expanded }
        itemControllers[model.id]?.row=row }
    val latestClick=rememberUpdatedState<()->Unit>({ click() })
    val a=style.a
    val shapeOf={ t:Double-> val ph=style.physical(tracks.corners.map { it.presented(t) })
        AWCCornerShape(AWCCornerRadius(AWCCornerLength(ph[0]),AWCCornerLength(ph[0])),AWCCornerRadius(AWCCornerLength(ph[1]),AWCCornerLength(ph[1])),
            AWCCornerRadius(AWCCornerLength(ph[2]),AWCCornerLength(ph[2])),AWCCornerRadius(AWCCornerLength(ph[3]),AWCCornerLength(ph[3]))) }
    val container=statusDotColor(style.containerColor);val ringColor=statusDotColor(style.color("secondary","#625B71"))
    val ring=style.focusRing(states)
    val layerColor=statusDotColor(parts[AWCListItemPart.StateLayer]?.backgroundColor ?: style.stateLayerColor)
    val rowFocused=row.focused
    val itemSemantics=Modifier.semantics(mergeDescendants=style.focusable) {
        // md-list-item.tsx roles: a selection row is an `option` with aria-selected (a radio button in a single-select
        // listbox, a checkbox in a multi-select one); a button/link row in a menu is a `menuitem` (a button here);
        // otherwise the primary action is a button. The row's index in its set is the collection item index.
        if(ctx?.inSelectionMode==true && style.participates) {
            if(ctx?.selectionMode=="multi-select") { role=Role.Checkbox;toggleableState=androidx.compose.ui.state.ToggleableState(row.selected) }
            else { role=Role.RadioButton;selected=row.selected } }
        if(model.disabled || model.softDisabled) disabled()
        if(model.expandable) { if(expanded) expand { row.toggle();true } else collapse { row.toggle();true } }
        val menuRow=(ctx?.containerRole=="menu" || ctx?.containerRole=="menubar") && !style.participates && style.interactive && (model.type=="button" || model.type=="link")
        if(style.hasPrimaryAction || menuRow) role=Role.Button
        collectionItemInfo=CollectionItemInfo(max(0,index),1,0,1)
        // The keyboard (roving) focus is reported to accessibility services, as Web reports the focused option.
        if(style.focusable) focused=rowFocused
    }
    val focusModifier=if(style.focusable) Modifier
        .onKeyEvent { e-> if(e.type!=KeyEventType.KeyDown || !row.focused) return@onKeyEvent false
            row.showFocus=true;noteInput(e.nativeKeyEvent.eventTime,key=true)
            val key=when(e.key) { Key.DirectionDown->"ArrowDown";Key.DirectionUp->"ArrowUp";Key.MoveHome->"Home";Key.MoveEnd->"End";Key.DirectionRight->"ArrowRight";Key.DirectionLeft->"ArrowLeft"
                Key.Enter,Key.NumPadEnter->"Enter";Key.Spacebar->" ";else->"" }
            if(e.isAltPressed && (key=="ArrowUp" || key=="ArrowDown") && style.reorderable) return@onKeyEvent owner?.keyReorder(row,key=="ArrowUp") ?: false
            if(e.isAltPressed || e.isCtrlPressed || e.isMetaPressed) return@onKeyEvent false
            when {
                key=="Enter" || key==" "->{ keyboardActivate();true }
                model.expandable && !style.disabledClass && key=="ArrowRight" && !expanded->{ toggleExpanded();true }
                model.expandable && !style.disabledClass && key=="ArrowLeft" && expanded->{ toggleExpanded();true }
                key=="ArrowRight" || key=="ArrowLeft"->true
                owner!=null && owner.move(key,row)->true
                owner!=null && e.utf16CodePoint>0->owner.typeaheadKey(e.utf16CodePoint.toChar(),row,e.nativeKeyEvent.eventTime)
                else->false }
        }
        .focusRequester(row.requester)
        .focusProperties { canFocus=!model.disabled && (tabbable || row.focused || row.pending) }
        .onFocusChanged { s-> if(row.focused!=s.isFocused) { row.focused=s.isFocused
            if(s.isFocused) { if(!row.pending) row.showFocus=true;row.pending=false;owner?.activate(row) } } }
        .focusTarget() else Modifier
    // Inspection at the frame the row renders: written after each composition (tracks.frame is read in
    // composition, so a running transition recomposes every frame) and again when the row draws.
    val dragDeltaNow=if(dragged) owner!!.dragDelta else 0f
    val inspectRow={ t:Double-> listInspection?.rows?.set(model.id,mapOf("frame" to t,"radius" to tracks.corners.map { it.presented(t) },"layerOpacity" to (if(style.layerVisible) tracks.layer.presented(t) else -1.0),
                "background" to style.containerColor,"labelColor" to style.labelColor,"leadingIconColor" to style.leadingIconColor(states),"trailingIconColor" to style.trailingIconColor(states),
                "focusRing" to ring,"panel" to tracks.panel.presented(t),"inner" to tracks.inner.presented(t),"caret" to tracks.caret.presented(t),"selected" to style.selectedClass,
                "expanded" to expanded,"lines" to style.lines,"interactive" to style.interactive,"tabbable" to tabbable,"focused" to row.focused,"stateLayerColor" to style.stateLayerColor,
                "padding" to style.padding.let { listOf(it.top,it.end,it.bottom,it.start) },"gap" to style.gap,"minHeight" to style.minHeight,"index" to index,
                "offsetY" to (if(dragged) dragDeltaNow else tracks.shift.presented(t).toFloat())/densityPx,
                "displayOffset" to (if(panelScope==null && owner!=null) owner.displayOffset(row) else 0f)/densityPx,
                "lift" to tracks.lift.presented(t),"dragged" to dragged,"handleOpacity" to tracks.handle[0].presented(t),"handleScale" to tracks.handle[2].presented(t),
                "headlineTooltip" to truncation.headline,"supportingTooltip" to truncation.supporting)) }
    SideEffect { inspectRow(tracks.frame) }
    // MARK: layout
    val elevation=remember(a.draggedContainerElevation,tokens) { a.draggedContainerElevation?.map { it.resolved() } ?: NativeShadowLayer.parse(tokens["--md-sys-elevation-4"]) }
    val liftShape=shapeOf(Double.MAX_VALUE)
    Column(Modifier
        .onGloballyPositioned { c-> registry?.place(row,c.positionInRoot().y,c.size.height.toFloat());if(owner!=null) owner.density=densityPx }
        .zIndex(if(ring || dragged || tracks.lift.presented(tracks.frame)>0) 1f else 0f)
        .graphicsLayer { translationY=(if(panelScope==null && owner!=null) owner.displayOffset(row) else 0f)+(if(dragged) owner!!.dragDelta else tracks.shift.presented(tracks.frame).toFloat()) }
        .accordionShadow(liftShape,{ val t=tracks.lift.presented(tracks.frame);if(t<=0) emptyList() else elevation.map { NativeShadowLayer(it.x*t,it.y*t,it.blur*t,it.spread*t,it.color.copy(alpha=it.color.alpha*t.toFloat()),it.inset) } },false)
        .then(if(inspect!=null && (listInspect!=null || panelInspect!=null)) Modifier.inspectAWCNode(inspect,"","md-list-item") else Modifier)
        .drawBehind {
            val t=tracks.frame;val shape=shapeOf(t)
            val outline=shape.createOutline(size,layoutDirection,this)
            drawOutline(outline,container)
            if(ring) { val inset=3.dp.toPx()
                clipPath(Path().apply { addOutline(outline) }) { drawOutline(outline,ringColor,style=Stroke(inset*2)) } }
            inspectRow(t)
        }
        .graphicsLayer { shape=shapeOf(tracks.frame);clip=true }
        .then(itemSemantics)) {
        // Row
        val pad=style.padding;val three=style.lines==3
        val centerLeading=model.hasAvatar
        Box(Modifier.fillMaxWidth()
            .then(focusModifier)
            .onGloballyPositioned { geometry.row=it }
            // `.md-list-item__row:hover` drives the layer: hovering the expanded panel does not.
            .pointerInput(Unit) { awaitPointerEventScope { while(true) { val e=awaitPointerEvent()
                // Hover follows every mouse event's position (a captured press keeps delivering moves without Exit).
                val c=e.changes.firstOrNull() ?: continue
                if(c.type!=androidx.compose.ui.input.pointer.PointerType.Mouse && e.type!=PointerEventType.Exit) continue
                noteInput(c.uptimeMillis)
                val p=c.position;val inside=p.x>=0 && p.y>=0 && p.x<size.width && p.y<size.height && e.type!=PointerEventType.Exit
                // After a reordering drop the handle stays unhovered until the pointer really moves.
                val d=dropAt[0];val r=if(d!=null) geometry.row?.localToRoot(p) else null
                val still=d!=null && r!=null && (r-d).getDistance()<1f;if(!still) dropAt[0]=null
                if(hovered!=inside && !(still && dropRest[0])) hovered=inside
                val overHandle=!still && inside && geometry.handle.contains(p);if(handleHovered!=overHandle) handleHovered=overHandle } } }
            .pointerInput(style.interactive,style.disabledClass,model.softDisabled,style.focusable,style.reorderable) { awaitEachGesture {
                val down=awaitFirstDown(requireUnconsumed=false)
                noteInput(down.uptimeMillis)
                if(down.isConsumed) {
                    // Pressed inside an authored control (it keeps its own click): the row is :active only.
                    if(style.interactive) { held=true;val press=PressInteraction.Press(down.position);if(!style.disabledClass) interactions.tryEmit(press)
                        val up=waitForUpOrCancellation();held=false;interactions.tryEmit(if(up!=null) PressInteraction.Release(press) else PressInteraction.Cancel(press)) }
                    return@awaitEachGesture
                }
                val rc=geometry.row
                if(style.reorderable && owner!=null && rc!=null && geometry.handle.contains(down.position) && owner.beginDrag(row,rc.localToRoot(down.position).y)) {
                    held=true;down.consume()
                    val press=PressInteraction.Press(down.position);interactions.tryEmit(press)
                    if(style.focusable && !row.focused) { row.showFocus=false;row.pending=true;runCatching { row.requester.requestFocus() } }
                    var last=down.position
                    while(true) { val e=awaitPointerEvent();val c=e.changes.firstOrNull() ?: break
                        noteInput(c.uptimeMillis);last=c.position;geometry.row?.let { owner.moveDrag(it.localToRoot(c.position).y) };c.consume()
                        if(!c.pressed) break }
                    val dropRoot=geometry.row?.localToRoot(last)
                    held=false;interactions.tryEmit(PressInteraction.Release(press))
                    // The drop re-inserts the moved row (source): it is not hovered until the pointer moves.
                    // The drop re-inserts the moved row: it rests for that frame, then Chrome re-applies :hover.
                    if(owner.endDrag()) { hovered=false;handleHovered=false;dropAt[0]=dropRoot;dropRest[0]=true
                        scope.launch { withFrameNanos { };dropRest[0]=false
                            val rc=geometry.row;if(dropRoot!=null && rc!=null && rc.isAttached) hovered=rc.boundsInRoot().contains(dropRoot) } }
                    return@awaitEachGesture
                }
                if(!style.interactive) return@awaitEachGesture
                held=true
                val press=PressInteraction.Press(down.position)
                if(!style.disabledClass) interactions.tryEmit(press)
                if(style.focusable && !row.focused) { row.showFocus=false;row.pending=true;runCatching { row.requester.requestFocus() } }
                val up=waitForUpOrCancellation()
                up?.let { noteInput(it.uptimeMillis) }
                held=false
                interactions.tryEmit(if(up!=null) PressInteraction.Release(press) else PressInteraction.Cancel(press))
                if(up!=null) latestClick.value()
            } }
            // Source paint order: the row's in-flow content, then the positioned md-ripple and state layer, then the
            // positioned image-wrap and caret host above them (the layer leaves the image and the open caret uncovered).
            .drawWithContent { drawContent()
                if(style.layerVisible) { val o=tracks.layer.presented(tracks.frame);if(o>0) {
                    val holes=Path().apply { geometry.image?.let { addRoundRect(RoundRect(it,CornerRadius((style.imageShape*density).toFloat()))) }
                        if(model.expandable && expanded) geometry.caret?.let { addOval(it) } }
                    clipPath(holes,ClipOp.Difference) { drawRect(layerColor.copy(alpha=layerColor.alpha*o.toFloat())) } } } }
            // md-ripple paints currentColor (the row's label colour).
            .then(nativeSourceRipple(interactions,statusDotColor(style.labelColor),style.interactive && !style.disabledClass && !dragged))
            .then(parts[AWCListItemPart.Row]?.let { pr-> if(pr.borderColor!=null && (pr.borderWidth ?: 0.0)>0) Modifier.drawBehind {
                val w=(pr.borderWidth!!*density).toFloat();drawRect(statusDotColor(pr.borderColor),Offset(w/2,w/2),Size(size.width-w,size.height-w),style=Stroke(w)) } else null } ?: Modifier)
            .then(if(inspect!=null) Modifier.inspectAWCNode(inspect,"row","row",AWCInspectionMetrics(padding=AWCInspectionInsets(pad.top,pad.end,pad.bottom,pad.start),gap=AWCInspectionGap(style.gap,style.gap))) else Modifier)) {
            CompositionLocalProvider(LocalNativeListRowGeometry provides geometry) {
            NativeListRowLayout(style.gap,pad,style.minHeight,three,centerLeading) {
                if(style.hasPrimaryAction) {
                    NativeListRowLayout(style.gap,NativeListItemStyle.Padding(0.0,0.0,0.0,0.0),0.0,three,centerLeading,Modifier.layoutId("content").then(if(inspect!=null) Modifier.inspectAWCNode(inspect,"primary","primary") else Modifier)) {
                        Leading(style,states,model,a,parts,inspect,content,slots,expanded)
                        Content(style,model,a,parts,inspect,content,overlineText,supportingText,defaultText,Modifier.layoutId("content"),truncation)
                    }
                } else {
                    Leading(style,states,model,a,parts,inspect,content,slots,expanded)
                    Content(style,model,a,parts,inspect,content,overlineText,supportingText,defaultText,Modifier.layoutId("content"),truncation)
                }
                Trailing(style,states,model,a,parts,inspect,content,tracks,expanded,geometry) { if(!style.disabledClass) toggleExpanded() }
            }
            }
        }
        if(model.expandable) Panel(style,a,parts,inspect,tracks,expanded,row,ctx,owner,content)
    }
}

/** Row and drag-handle geometry for pointer reorder (local to the row). */
internal class NativeListRowGeometry { var row:LayoutCoordinates?=null;var handle=androidx.compose.ui.geometry.Rect.Zero
    /** Positioned parts painted above the ripple and state layer in the source (image-wrap, the caret host). */
    var image:androidx.compose.ui.geometry.Rect?=null;var caret:androidx.compose.ui.geometry.Rect?=null }
internal val LocalNativeListRowGeometry=staticCompositionLocalOf<NativeListRowGeometry?> { null }
private fun NativeListRowGeometry.place(c:LayoutCoordinates):androidx.compose.ui.geometry.Rect?=row?.takeIf { it.isAttached && c.isAttached }?.localBoundingBoxOf(c)

/** The row flex box: fixed leading/trailing, a flexible content (or primary) column, gap, padding and
 * min-height; three-line rows align to the top and stretch the trailing column. */
@Composable private fun NativeListRowLayout(gap:Double,pad:NativeListItemStyle.Padding,minHeight:Double,three:Boolean,centerLeading:Boolean,modifier:Modifier=Modifier,content:@Composable ()->Unit) {
    Layout(content,modifier) { measurables,constraints->
        val d=density
        fun px(v:Double)=(v*d).roundToInt()
        val width=if(constraints.hasBoundedWidth) constraints.maxWidth else 0
        val inner=width-px(pad.start)-px(pad.end)
        val roles=measurables.map { (it.layoutId as? String) ?: "" }
        // The three-line trailing column stretches to the row's inner height: size it by its
        // intrinsics first and measure it once that height is known.
        val deferred=measurables.indices.filter { three && roles[it]=="trailing" }.toSet()
        val natural=measurables.mapIndexed { i,m-> if(i in deferred) { val w=m.maxIntrinsicWidth(Constraints.Infinity);IntSize(w,if(w>0) m.minIntrinsicHeight(w) else 0) } else null }
        // Fixed children at their natural size; absent (empty) slots take no gap.
        val fixed=measurables.mapIndexed { i,m-> if(roles[i]=="content" || i in deferred) null else m.measure(Constraints()) }
        fun w(i:Int)=fixed[i]?.width ?: natural[i]?.width ?: 0
        fun hh(i:Int)=fixed[i]?.height ?: natural[i]?.height ?: 0
        val present=measurables.indices.filter { roles[it]=="content" || w(it)>0 || hh(it)>0 }
        val gaps=px(gap)*max(0,present.size-1)
        val flexible=max(0,inner-present.filter { roles[it]!="content" }.sumOf { w(it) }-gaps)
        val contentP=measurables.mapIndexed { i,m-> if(roles[i]=="content") m.measure(Constraints(minWidth=flexible,maxWidth=flexible)) else null }
        val contentH=present.maxOfOrNull { contentP[it]?.height ?: hh(it) } ?: 0
        val h=max(px(minHeight),px(pad.top)+px(pad.bottom)+contentH)
        val innerH=h-px(pad.top)-px(pad.bottom)
        val final=measurables.mapIndexed { i,m-> fixed[i] ?: contentP[i] ?: m.measure(Constraints(minWidth=w(i),maxWidth=max(w(i),0),minHeight=innerH,maxHeight=innerH)) }
        layout(width,h) {
            var x=px(pad.start)
            for(i in present) { val p=final[i]
                val y=if(three) { if(roles[i]=="leading" && centerLeading) px(pad.top)+(innerH-p.height)/2 else px(pad.top) } else px(pad.top)+((innerH-p.height)/2.0).roundToInt()
                p.placeRelative(x,y);x+=p.width+px(gap) }
        }
    }
}
/** Three-line trailing column (`flex-direction: column; align-items: flex-end`): a `margin-block: auto`
 * child (layoutId "auto", the trailing icon) centres in the remaining space. */
@Composable private fun NativeListTrailingColumn(modifier:Modifier,content:@Composable ()->Unit) {
    Layout(content,modifier) { measurables,constraints->
        val ps=measurables.map { it.measure(Constraints()) }
        val natural=ps.sumOf { it.height };val w=ps.maxOfOrNull { it.width } ?: 0
        val h=if(constraints.hasBoundedHeight) max(natural,constraints.minHeight) else natural
        layout(w,h) { var y=0
            ps.forEachIndexed { i,p-> val x=w-p.width
                if(measurables[i].layoutId=="auto") { val after=ps.drop(i+1).sumOf { it.height };val remaining=h-y-after
                    p.placeRelative(x,y+max(0,(remaining-p.height)/2));y+=max(p.height,remaining) } else { p.placeRelative(x,y);y+=p.height } } }
    }
}

@Composable private fun Leading(s:NativeListItemStyle,st:NativeListItemStates,model:NativeListItemModel,a:AWCListItemAppearance,parts:Map<AWCListItemPart,AWCAccordionPartAppearance>,
                                inspect:AWCInspectionContext?,content:Slot?,slots:NativeListItemSlots,expanded:Boolean) {
    val ink=statusDotColor(parts[AWCListItemPart.LeadingIcon]?.color ?: s.leadingIconColor(st))
    val leadingInspect=if(inspect!=null) Modifier.inspectAWCNode(inspect,"leading","leading") else Modifier
    Box(Modifier.layoutId("leading")) {
        when {
            model.hasAvatar->Box(Modifier.widthIn(min=24.dp).then(leadingInspect)) { Avatar(s,model,a,inspect) }
            model.leadingImage.isNotEmpty()->Box(Modifier.widthIn(min=24.dp).then(leadingInspect)) { ListItemImage(s,model,a,inspect) }
            model.leadingIcon.isNotEmpty()->Box(Modifier.widthIn(min=24.dp).then(leadingInspect),contentAlignment=Alignment.Center) {
                ListSymbol(model.leadingIcon,s.leadingIconSize,ink,if(expanded) 1.0 else 0.0,modifier=if(inspect!=null) Modifier.inspectAWCNode(inspect,"leading-icon","leading-icon") else Modifier) }
            else->Box(Modifier.then(leadingInspect)) {
                CompositionLocalProvider(LocalNativeListItemSlots provides slots,LocalNativeListItemResolved provides a,androidx.compose.material3.LocalContentColor provides ink) { Row { content?.invoke("leading") } } }
        }
    }
}
@Composable private fun Avatar(s:NativeListItemStyle,model:NativeListItemModel,a:AWCListItemAppearance,inspect:AWCInspectionContext?) {
    val size=a.leadingAvatarSize ?: 40.0;val shape=AWCCornerShape.uniform(minOf(a.leadingAvatarShape ?: 9999.0,size/2))
    val label=statusDotColor(a.leadingAvatarLabelColor ?: s.color("on-primary-container","#21005D"))
    val initials=if(model.leadingAvatarLabel.isNotEmpty()) model.leadingAvatarLabel.take(2).uppercase() else {
        val words=model.leadingAvatarName.split(" ").filter { it.isNotEmpty() }
        if(words.size>1) (words.first().take(1)+words.last().take(1)).uppercase() else (words.firstOrNull()?.take(1) ?: "").uppercase() }
    Box(Modifier.size(size.dp).clip(shape).background(statusDotColor(a.leadingAvatarColor ?: s.color("primary-container","#EADDFF")),RectangleShape)
        .then(if(inspect!=null) Modifier.inspectAWCNode(inspect,"avatar","avatar") else Modifier),contentAlignment=Alignment.Center) {
        if(model.leadingAvatar.isNotEmpty()) ListImage(model.leadingAvatar,Modifier.fillMaxSize())
        else BasicText(initials,style=listTextStyle(16.0,16.0,500,.15,label),maxLines=1,softWrap=false)
    }
}
@Composable private fun ListItemImage(s:NativeListItemStyle,model:NativeListItemModel,a:AWCListItemAppearance,inspect:AWCInspectionContext?) {
    val w=a.leadingImageWidth ?: 56.0;val h=a.leadingImageHeight ?: 56.0;val icon=a.leadingImageSelectionIconSize ?: 24.0
    val rowGeometry=LocalNativeListRowGeometry.current
    Box(Modifier.size(w.dp,h.dp).onGloballyPositioned { c-> rowGeometry?.let { g-> g.image=g.place(c) } }
        .clip(AWCCornerShape.uniform(s.imageShape)).then(if(inspect!=null) Modifier.inspectAWCNode(inspect,"image","image") else Modifier),contentAlignment=Alignment.Center) {
        ListImage(model.leadingImage,Modifier.fillMaxSize())
        if(s.selectedClass) {
            Box(Modifier.fillMaxSize().background(statusDotColor(a.leadingImageSelectionScrimColor ?: NativeListItemStyle.mix(s.color("scrim","#000000"),.32)),RectangleShape))
            Box(Modifier.size(icon.dp).clip(CircleShape).background(statusDotColor(a.leadingImageSelectionCircleColor ?: NativeListItemStyle.mix(s.color("on-surface","#1D1B20"),.6)),RectangleShape))
            ListSymbol("check",icon*.667,statusDotColor(a.leadingImageSelectionIconColor ?: s.color("surface","#FEF7FF")),1.0)
        }
    }
}
@Composable private fun Content(s:NativeListItemStyle,model:NativeListItemModel,a:AWCListItemAppearance,parts:Map<AWCListItemPart,AWCAccordionPartAppearance>,inspect:AWCInspectionContext?,
                                content:Slot?,overline:AWCSlotTextRegistry,supporting:AWCSlotTextRegistry,defaultText:AWCSlotTextRegistry,modifier:Modifier,
                                truncation:NativeListTruncation?=null) {
    @Composable fun ins(part:String)=if(inspect!=null) Modifier.inspectAWCNode(inspect,part,part) else Modifier
    val hp=parts[AWCListItemPart.Headline]
    val headlineStyle=listTextStyle(s.headlineSize,s.headlineLine,400,hp?.letterSpacing ?: .5,statusDotColor(hp?.color ?: s.labelColor),a.labelTextFont)
    val overlineStyle=listTextStyle(11.0,16.0,500,.5,statusDotColor(parts[AWCListItemPart.Overline]?.color ?: s.overlineColor))
    val supportingStyle=listTextStyle(s.supportingSize,s.supportingLine,400,.25,statusDotColor(parts[AWCListItemPart.SupportingText]?.color ?: s.supportingColor),a.supportingTextFont)
    @Composable fun slot(name:String,style:TextStyle,registry:AWCSlotTextRegistry?,lines:Int) {
        CompositionLocalProvider(LocalTextStyle provides style,androidx.compose.material3.LocalContentColor provides (style.color),LocalAWCSlotTextRegistry provides registry,
            LocalAWCSlotTextNoWrap provides (lines==1)) { content?.invoke(name) }
    }
    Column(modifier.then(ins("content"))) {
        if(model.overline.isNotEmpty()) ListText(model.overline.uppercase(),overlineStyle,Modifier.fillMaxWidth().then(ins("overline")))
        else Box(Modifier.fillMaxWidth().then(if(overline.hasEntries) ins("overline") else Modifier)) { slot("overline",overlineStyle,overline,1) }
        Box(Modifier.fillMaxWidth().then(ins("headline"))) {
            if(model.headline.isNotEmpty()) ListTruncationTooltip(model.headline,truncation?.headline==true) {
                ListText(model.headline,headlineStyle,Modifier.fillMaxWidth()) { o-> if(truncation!=null && truncation.headline!=o) truncation.headline=o } }
            else { slot("headline",headlineStyle,null,1);slot("",headlineStyle,defaultText,1) }
        }
        val lines=if(s.lines==3) 2 else 1
        if(model.supportingText.isNotEmpty()) Box(Modifier.fillMaxWidth().then(ins("supporting-text"))) { ListTruncationTooltip(model.supportingText,truncation?.supporting==true) {
            ListText(model.supportingText,supportingStyle,Modifier.fillMaxWidth(),lines) { o-> if(truncation!=null && truncation.supporting!=o) truncation.supporting=o } } }
        else Box(Modifier.fillMaxWidth().then(if(supporting.hasEntries) ins("supporting-text") else Modifier)) { slot("supporting-text",supportingStyle,supporting,lines) }
    }
}
@Composable private fun Trailing(s:NativeListItemStyle,st:NativeListItemStates,model:NativeListItemModel,a:AWCListItemAppearance,parts:Map<AWCListItemPart,AWCAccordionPartAppearance>,
                                 inspect:AWCInspectionContext?,content:Slot?,tracks:NativeListTracks,expanded:Boolean,geometry:NativeListRowGeometry,toggle:()->Unit) {
    @Composable fun ins(part:String)=if(inspect!=null) Modifier.inspectAWCNode(inspect,part,part) else Modifier
    val ink=statusDotColor(parts[AWCListItemPart.TrailingIcon]?.color ?: s.trailingIconColor(st))
    val trailingStyle=listTextStyle(11.0,16.0,500,0.0,statusDotColor(parts[AWCListItemPart.TrailingSupportingText]?.color ?: s.trailingTextColor),a.trailingSupportingTextFont)
    val bg=parts[AWCListItemPart.Trailing]?.backgroundColor
    val items:@Composable ()->Unit={
        CompositionLocalProvider(LocalTextStyle provides trailingStyle,androidx.compose.material3.LocalContentColor provides ink,LocalAWCSlotTextNoWrap provides true) {
            Box { Row(verticalAlignment=Alignment.CenterVertically) { content?.invoke("trailing") } }
            Box { content?.invoke("trailing-supporting-text") }
        }
        if(model.trailingSupportingText.isNotEmpty()) NativeSourceText(model.trailingSupportingText,trailingStyle,ins("trailing-supporting-text"),wrap=false)
        if(model.trailingIcon.isNotEmpty()) ListSymbol(model.trailingIcon,s.trailingIconSize,ink,modifier=Modifier.layoutId("auto").then(ins("trailing-icon")))
        if(model.expandable) CaretButton(s,a,tracks,expanded,inspect,toggle)
        if(s.reorderable) { val base=statusDotColor(parts[AWCListItemPart.DragHandle]?.color ?: s.trailingIconColor(st));val hover=statusDotColor(s.onSurface)
            val ink=if(parts[AWCListItemPart.DragHandle]?.color!=null) base else androidx.compose.ui.graphics.lerp(base,hover,tracks.handle[1].presented(Double.MAX_VALUE).toFloat())
            ListSymbol("drag_indicator",24.0,ink,glyphSize=22.0,
                modifier=Modifier.onGloballyPositioned { c-> geometry.row?.takeIf { it.isAttached }?.let { geometry.handle=it.localBoundingBoxOf(c) } }
                    .graphicsLayer { val t=tracks.frame;alpha=tracks.handle[0].presented(t).toFloat();scaleX=tracks.handle[2].presented(t).toFloat();scaleY=scaleX }.then(ins("drag-handle"))) }
    }
    val mod=Modifier.layoutId("trailing").then(if(bg!=null) Modifier.background(statusDotColor(bg),RectangleShape) else Modifier).then(ins("trailing"))
    if(s.lines==3) NativeListTrailingColumn(mod,items)
    else Layout(items,mod) { measurables,_->
        val ps=measurables.map { it.measure(Constraints()) }.filter { it.width>0 || it.height>0 }
        val gap=(4*density).roundToInt();val w=ps.sumOf { it.width }+gap*max(0,ps.size-1);val h=ps.maxOfOrNull { it.height } ?: 0
        layout(w,h) { var x=0;ps.forEach { p-> p.placeRelative(x,(h-p.height)/2);x+=p.width+gap } }
    }
}
@Composable private fun CaretButton(s:NativeListItemStyle,a:AWCListItemAppearance,tracks:NativeListTracks,open:Boolean,inspect:AWCInspectionContext?,toggle:()->Unit) {
    val size=a.expandButtonSize ?: 32.0;val chevron=a.expandChevronSize ?: 24.0
    val ink=statusDotColor(if(open) s.color("on-primary","#FFFFFF") else s.chevronColor)
    val fill=statusDotColor(s.color("primary","#6750A4"))
    val owner=LocalNativeListOwner.current
    var focused by remember { mutableStateOf(false) };var keyFocus by remember { mutableStateOf(false) }
    var hover by remember { mutableStateOf(false) };var pressing by remember { mutableStateOf(false) }
    val rowGeometry=LocalNativeListRowGeometry.current
    val ringColor=statusDotColor(s.color("secondary","#625B71"));val inkColor=ink
    Box(Modifier.layout { m,c-> val p=m.measure(c);layout(p.width-(4*density).roundToInt(),p.height) { p.placeRelative(0,0) } }) {
        Box(Modifier.size(size.dp).then(if(inspect!=null) Modifier.inspectAWCNode(inspect,"expand-button","expand-button") else Modifier)
            .onGloballyPositioned { c-> rowGeometry?.let { g-> g.caret=g.place(c) } }
            .onFocusChanged { f-> focused=f.isFocused;if(f.isFocused) keyFocus=owner?.inputIsKey==true }
            .pointerInput(Unit) { val box=this.size;awaitPointerEventScope { while(true) { val e=awaitPointerEvent()
                val c=e.changes.firstOrNull() ?: continue;if(c.type!=androidx.compose.ui.input.pointer.PointerType.Mouse && e.type!=PointerEventType.Exit) continue
                val p=c.position;val inside=e.type!=PointerEventType.Exit && p.x>=0 && p.y>=0 && p.x<box.width && p.y<box.height;if(hover!=inside) hover=inside } } }
            .drawBehind { if(open) drawCircle(fill)
                // md-icon-button's own state layer (ink): pressed 0.10, focus-visible 0.12, hover 0.08.
                val layer=if(s.disabledClass) 0f else if(pressing) .1f else if(focused && keyFocus) .12f else if(hover) .08f else 0f
                if(layer>0) drawCircle(inkColor.copy(alpha=layer))
                // md-icon-button :focus-visible: a 3px secondary outline offset by 2px.
                if(focused && keyFocus) {
                    drawCircle(ringColor,radius=this.size.minDimension/2+3.5.dp.toPx(),style=androidx.compose.ui.graphics.drawscope.Stroke(3.dp.toPx())) } }
            .pointerInput(s.disabledClass) { awaitEachGesture { val d=awaitFirstDown();d.consume();pressing=true
                val up=waitForUpOrCancellation();pressing=false;if(up!=null) { up.consume();toggle() } } }
            .onKeyEvent { e-> if(e.type==KeyEventType.KeyDown && (e.key==Key.Enter || e.key==Key.NumPadEnter || e.key==Key.Spacebar) && !s.disabledClass) {
                owner?.let { it.inputTime=e.nativeKeyEvent.eventTime.toDouble();it.inputIsKey=true };toggle();true } else false }
            .focusProperties { canFocus=!s.model.disabled }.focusTarget()
            .semantics { role=Role.Button;contentDescription=if(open) "Collapse" else "Expand" },
            contentAlignment=Alignment.Center) {
            Box(Modifier.graphicsLayer { rotationZ=(180*tracks.caret.presented(tracks.frame)).toFloat() }) { ListSymbol("expand_more",chevron,ink) }
        }
    }
}
@Composable private fun Panel(s:NativeListItemStyle,a:AWCListItemAppearance,parts:Map<AWCListItemPart,AWCAccordionPartAppearance>,inspect:AWCInspectionContext?,tracks:NativeListTracks,
                              expanded:Boolean,row:NativeListRow,ctx:NativeListItemContext?,owner:NativeListOwner?,content:Slot?) {
    val start=a.expandedPanelPaddingInlineStart ?: a.expandedPanelPaddingInline ?: 0.0;val end=a.expandedPanelPaddingInline ?: 0.0;val block=a.expandedPanelPaddingBlock ?: 0.0
    val bg=parts[AWCListItemPart.ExpandedPanel]?.backgroundColor ?: a.expandedPanelBackground
    val scope=remember(row,ctx,owner,inspect) { NativeListPanelScope(row,ctx,owner,{ child-> owner?.childClicked(row,child) },inspect) }
    Layout(content={
        Column(Modifier.graphicsLayer { translationY=(-8*(1-tracks.inner.presented(tracks.frame))*density).toFloat() }
            .padding(start=start.dp,end=end.dp,top=block.dp,bottom=block.dp)) {
            CompositionLocalProvider(LocalNativeListPanel provides scope) { content?.invoke("expanded-content") }
        }
    },modifier=Modifier.fillMaxWidth().clipToBounds().graphicsLayer { alpha=tracks.panel.presented(tracks.frame).toFloat() }
        .then(if(bg!=null) Modifier.background(statusDotColor(bg),RectangleShape) else Modifier)
        .then(if(inspect!=null) Modifier.inspectAWCNode(inspect,"expanded-panel","expanded-panel",allowZeroSize=true) else Modifier)
        .semantics { if(!expanded) hideFromAccessibility() }) { measurables,constraints->
        val p=measurables.single().measure(constraints.copy(minHeight=0,maxHeight=Constraints.Infinity))
        val f=tracks.panel.presented(tracks.frame)
        // The source's 0fr grid row cannot shrink the panel below its block padding (the padding is the grid
        // item's min-content), so a collapsed panel with `expanded-panel-padding-block` keeps that height.
        layout(constraints.maxWidth,max((2*block*density).roundToInt(),(p.height*f).roundToInt())) { p.placeRelative(0,0) }
    }
}
private fun Modifier.clipToBounds()=this.then(Modifier.graphicsLayer { clip=true })
