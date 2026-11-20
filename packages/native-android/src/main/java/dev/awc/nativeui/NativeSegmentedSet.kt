@file:Suppress("DEPRECATION")
package dev.awc.nativeui

import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.*
import androidx.compose.ui.node.*
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.*
import androidx.compose.ui.unit.*
import kotlin.math.*

internal data class SegmentEntry(val id:Any,val targetID:String,val value:String,val disabled:Boolean,
    val focus:AWCButtonFocusState,val activate:(AWCActivationMetadata)->Unit)
internal class SegmentedSetScope(props:Props,val parent:SegmentedSetScope?) {
    var props by mutableStateOf(props)
        private set
    private val depth:Int=(parent?.depth ?: -1)+1
    var revision by mutableLongStateOf(-depth.toLong())
        private set
    companion object { private var nextRevision=1L }
    val selected:androidx.compose.runtime.snapshots.SnapshotStateMap<Any,Boolean> =parent?.selected ?: mutableStateMapOf<Any,Boolean>()
    private val registrations:MutableMap<Any,Int> =parent?.registrations ?: mutableMapOf<Any,Int>()
    private val members=linkedMapOf<Any,SegmentEntry>()
    private var membership by mutableIntStateOf(0)
    val entries:List<SegmentEntry> get() { membership;return members.values.toList() }
    var emitChange:(List<String>,AWCActivationMetadata)->Unit={_,_->}
    fun update(next:Props) { if(props!=next) { props=next;revision=nextRevision++ } }
    fun register(entry:SegmentEntry,initial:Boolean) {
        if(entry.id !in members) {
            registrations[entry.id]=(registrations[entry.id] ?: 0)+1
            if(entry.id !in selected) selected[entry.id]=initial
            membership++
        }
        members[entry.id]=entry
    }
    fun remove(id:Any) {
        if(members.remove(id)!=null) {
            val count=(registrations[id] ?: 1)-1
            if(count<=0) { registrations.remove(id);selected.remove(id) } else registrations[id]=count
            membership++;revision=nextRevision++
        }
    }
    private var orderedOnce=false
    fun reorder(ids:List<Any>) {
        val previous=entries.map { it.id }
        if(ids.toSet()!=previous.toSet()) return
        if(previous!=ids) {
            val next=ids.map { members.getValue(it) };members.clear();next.forEach { members[it.id]=it };membership++
            if(orderedOnce) revision=nextRevision++
        }
        orderedOnce=true
    }
    fun accept(targetID:String,proposed:Boolean,activation:AWCActivationMetadata):Boolean {
        val clicked=entries.find { it.targetID==targetID } ?: return false
        if(props.bool("multiselect")) selected[clicked.id]=proposed else entries.forEach { selected[it.id]=it.id===clicked.id }
        emitChange(entries.filter { selected[it.id]==true }.map { it.value },activation)
        return true
    }
    fun move(id:Any,forward:Boolean,select:Boolean):Boolean {
        val enabled=entries.filter { !it.disabled };val index=enabled.indexOfFirst { it.id===id }
        if(index<0) return false
        val next=enabled[(index+(if(forward) 1 else -1)+enabled.size)%enabled.size]
        next.focus.requestFocus()
        if(select) next.activate(AWCActivationMetadata("keyboard"))
        return true
    }
}
internal val LocalSegmentedSets=compositionLocalOf<List<SegmentedSetScope>> { emptyList() }
internal val LocalSegmentedInset=compositionLocalOf { 12f }
internal data class SegmentedChild(val id:Any,var minimumWidth:Int=0,var naturalWidth:Float=-1f)
internal val LocalSegmentedChild=staticCompositionLocalOf<SegmentedChild?> { null }

/** CSS equal fr tracks freeze at their own padding floors before sharing the remainder. */
internal fun segmentedTrackWidths(width:Int,minimums:List<Int>):List<Int> {
    val tracks=DoubleArray(minimums.size)
    val flexible=minimums.indices.toMutableSet()
    var remaining=width.toDouble()
    while(flexible.isNotEmpty()) {
        val share=remaining/flexible.size
        val frozen=flexible.filter { minimums[it]>share }
        if(frozen.isEmpty()) { flexible.forEach { tracks[it]=max(0.0,share) };break }
        frozen.forEach { tracks[it]=minimums[it].toDouble();remaining-=minimums[it];flexible.remove(it) }
    }
    var edge=0.0
    return tracks.map { value -> val before=edge.roundToInt();edge+=value;edge.roundToInt()-before }
}

private object SegmentTreeKey
private class SegmentTreeNode(var scope:SegmentedSetScope?,var child:Any?):Modifier.Node(),TraversableNode,GlobalPositionAwareModifierNode {
    override val traverseKey:Any=SegmentTreeKey
    fun refresh() {
        val group=scope ?: return
        val ids=mutableListOf<Any>()
        traverseDescendants(SegmentTreeKey) { node ->
            (node as? SegmentTreeNode)?.child?.let { if(it !in ids) ids+=it }
            TraversableNode.Companion.TraverseDescendantsAction.ContinueTraversal
        }
        group.reorder(ids)
    }
    override fun onGloballyPositioned(coordinates:LayoutCoordinates) {
        refresh();traverseAncestors(SegmentTreeKey) { (it as? SegmentTreeNode)?.refresh();true }
    }
}
private data class SegmentTreeElement(val scope:SegmentedSetScope?,val child:Any?):ModifierNodeElement<SegmentTreeNode>() {
    override fun create()=SegmentTreeNode(scope,child)
    override fun update(node:SegmentTreeNode) { node.scope=scope;node.child=child }
}
internal fun Modifier.segmentTree(scope:SegmentedSetScope?=null,child:Any?=null)=then(SegmentTreeElement(scope,child))

@Composable internal fun NativeSegmentedSet(p:Props,emit:EventSink,slot:Slot?) {
    if(p.bool("hidden")) return
    val ancestors=LocalSegmentedSets.current
    val scope=remember(ancestors.lastOrNull()) { SegmentedSetScope(p,ancestors.lastOrNull()) }
    SideEffect { scope.update(p) }
    val actions=LocalAWCAction.current;val target=LocalAWCActionTarget.current
    val targetID=remember { java.util.UUID.randomUUID().toString() }
    SideEffect { scope.emitChange={ values,activation ->
        // onEvent preserves the source array. The existing scoped dispatcher is
        // map-shaped, so its documented native equivalent carries the same array.
        dispatchNativeAction(AWCActionEvent("mdChange","md-segmented-button-set",mapOf("values" to values),cancelable=true,
            targetID=target?.id ?: targetID,activation=activation,rawDetail=values),actions,target?.listeners?.invoke().orEmpty())
        emit("mdChange",values)
    } }
    val state=LocalAWCSegmentedButtonSetState.current
    SideEffect { state?.bind(scope) { scope.entries.map { scope.selected[it.id]==true } } }
    DisposableEffect(state,scope) { onDispose { state?.unbind(scope) } }
    val inset=if(p.int("density") in -4..-2) 8f else LocalSegmentedInset.current
    val inspection=LocalAWCInspection.current
    MultiMeasureLayout(content={
        AWCActionScope(id=p.str("id").ifEmpty { null },onAction={ event ->
            if(event.name=="mdSegmentClick" && scope.entries.any { it.targetID==event.targetID }) {
                event.stopPropagation();scope.accept(event.targetID,event.detail["selected"]==true,event.activation)
            }
        }) {
            CompositionLocalProvider(LocalSegmentedSets provides ancestors+scope,LocalSegmentedInset provides inset,
                LocalAWCSegmentedButtonSetState provides null,LocalAWCActionTarget provides null) { slot?.invoke("") }
        }
    },modifier=Modifier.segmentTree(scope=scope)
        .then(if(!p.bool("multiselect")) Modifier.selectableGroup() else Modifier)
        .semantics { collectionInfo=CollectionInfo(1,scope.entries.size) }
        .inspectAWCNode(inspection,"","md-segmented-button-set",AWCInspectionMetrics(padding=AWCInspectionInsets(),margin=AWCInspectionInsets(),
            border=AWCInspectionInsets(),gap=AWCInspectionGap(0.0,0.0),display="Grid",direction=if(LocalLayoutDirection.current==LayoutDirection.Rtl) "rtl" else "ltr"))) { children,constraints ->
        val natural=children.map { it.measure(Constraints()) }
        val one=1.dp.roundToPx()
        val ordered=scope.entries.map { it.id }
        fun overlap(index:Int):Int {
            val id=(children[index].layoutId as? SegmentedChild)?.id ?: return 0
            return if(ordered.size>1 && ordered.lastOrNull()===id) one else 0
        }
        // CSS 1fr tracks: the widest max-content (fractional); the total rounds once and is distributed below.
        val track=natural.indices.maxOfOrNull { i -> max(0f,((children[i].layoutId as? SegmentedChild)?.naturalWidth?.takeIf { it>=0f } ?: natural[i].width.toFloat())-overlap(i)) } ?: 0f
        val width=constraints.constrainWidth((track*children.size).roundToInt())
        val height=constraints.constrainHeight(natural.maxOfOrNull { it.height } ?: 0)
        val tracks=segmentedTrackWidths(width,children.indices.map { i ->
            max(0,((children[i].layoutId as? SegmentedChild)?.minimumWidth ?: 0)-overlap(i))
        })
        val measured=children.mapIndexed { i,child -> child.measure(Constraints.fixed(tracks[i]+overlap(i),max(height,natural[i].height))) }
        layout(width,height) { var x=0;measured.forEachIndexed { i,child->child.placeRelative(x-overlap(i),0);x+=tracks[i] } }
    }
}
