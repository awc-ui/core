package dev.awc.nativeui

import androidx.compose.runtime.*

/** Retained identity survives collapse and display-order changes. Only direct
 * children participate in an owner's coordination; nested accordions are local. */
internal class NativeAccordionItemState(
    val id:String, expanded:Boolean=false, disabled:Boolean=false,
    headingLevel:Int=3, regionRole:String="region", collapsible:Boolean=true,
) {
    var expanded by mutableStateOf(expanded); private set
    var disabled by mutableStateOf(disabled)
    var headingLevel by mutableStateOf(headingLevel)
    var regionRole by mutableStateOf(regionRole)
    var collapsible by mutableStateOf(collapsible)
    /** `hidden` (`display: none`): coordinated, not rendered, takes no gap, ignores focusHeader. */
    var hidden by mutableStateOf(false)
    var index by mutableStateOf(-1); private set
    var hasChassisHandle by mutableStateOf(false); private set
    var owner:NativeAccordionState?=null; private set
    private data class Authored(val heading:Int,val region:String,val collapsible:Boolean)
    private var authored:Authored?=null
    /** True when the event reaches its owner's listener. Preventing default
     * does not undo the local mutation; stopping propagation skips coordination. */
    var emit:(String,AWCValue)->Boolean={_,_->true}
    var requestFocus:()->Unit={}
    val toggleBlocked get()=disabled || (expanded && !collapsible)
    fun toggle() { if(!toggleBlocked) assignExpanded(!expanded) }
    fun focusHeader() { if(!disabled && !hidden) requestFocus() }
    fun assignExpanded(value:Boolean) {
        if(expanded==value) return
        expanded=value
        val receiver=owner;val eventIndex=index
        if(emit("mdItemToggle",mapOf("expanded" to value,"index" to eventIndex))) receiver?.itemToggled(this,value,eventIndex)
    }
    fun key(key:String,alt:Boolean=false):Boolean {
        if(disabled) return false
        val receiver=owner;val from=index
        if(alt && (key=="ArrowUp" || key=="ArrowDown")) {
            val direction=if(key=="ArrowUp") "up" else "down"
            if(emit("mdItemRequestReorder",mapOf("direction" to direction,"from" to from))) receiver?.keyboardReorder(this,direction,from)
            return true
        }
        if(key=="Enter" || key==" ") { toggle();return true }
        val direction=when(key) { "ArrowDown"->"next";"ArrowUp"->"prev";"Home"->"first";"End"->"last";else->return false }
        if(emit("mdItemRequestFocus",mapOf("direction" to direction,"from" to from))) receiver?.navigate(this,direction,from)
        return true
    }
    fun claim(owner:NativeAccordionState,index:Int) {
        if(authored==null) authored=Authored(headingLevel,regionRole,collapsible)
        this.owner=owner;this.index=index;hasChassisHandle=owner.configuration.floating && index==0
    }
    fun release(owner:NativeAccordionState) {
        if(this.owner!==owner) return
        authored?.let { headingLevel=it.heading;regionRole=it.region;collapsible=it.collapsible }
        authored=null;this.owner=null;index=-1;hasChassisHandle=false
    }
}

internal data class NativeAccordionConfiguration(
    val variant:String="filled",val density:Double=0.0,val elevation:Int=0,
    val reorderable:Boolean=false,val floating:Boolean=false,
    val initialX:Double=24.0,val initialY:Double=24.0,val bringToFront:Boolean=true,
    val exclusive:Boolean=false,val keepOneExpanded:Boolean=false,val headingLevel:Int=3,
    val region:String="auto",val regionThreshold:Double=6.0,val transition:String="expressive",val defaultExpanded:String="",
)
internal data class AccordionItemRect(val top:Double,val height:Double)
internal data class AccordionPlaceholder(val top:Double,val height:Double)
private data class AccordionReorder(
    val item:NativeAccordionItemState,val pointer:Int,val from:Int,val target:Int,
    val startY:Double,val hostTop:Double,val distance:Double,val rects:List<AccordionItemRect>,
)
private data class AccordionChassisDrag(val pointer:Int,val clientX:Double,val clientY:Double,val x:Double,val y:Double)

/** Source state and event ordering, independent of Compose layout. Native
 * renderers translate physical viewport dp into these pointer coordinates. */
internal class NativeAccordionState(configuration:NativeAccordionConfiguration=NativeAccordionConfiguration()) {
    var configuration by mutableStateOf(configuration); private set
    var items:List<NativeAccordionItemState> by mutableStateOf(emptyList()); private set
    var x by mutableStateOf(0.0); private set
    var y by mutableStateOf(0.0); private set
    var zIndex:Int? by mutableStateOf(null); private set
    var chassisDragging by mutableStateOf(false); private set
    var dropPlaceholder:AccordionPlaceholder? by mutableStateOf(null); private set
    var draggedItemID:String? by mutableStateOf(null); private set
    var draggedOffset by mutableStateOf(0.0); private set
    var siblingOffsets:Map<String,Double> by mutableStateOf(emptyMap()); private set
    var emit:EventSink={_,_->}
    private val originalOrder=mutableListOf<NativeAccordionItemState>()
    private var loaded=false
    private var connected=false
    private var reorder:AccordionReorder?=null
    private var chassis:AccordionChassisDrag?=null
    val expandedIndices get()=items.indices.filter { items[it].expanded }
    val originalIndices get()=items.map { item->originalOrder.indexOfFirst { it===item } }
    private fun owns(item:NativeAccordionItemState)=item.owner===this && items.any { it===item }

    fun connect(children:List<NativeAccordionItemState>) {
        connected=true
        synchronize(children)
        if(loaded) return
        loaded=true
        val defaults=defaultIndices(configuration.defaultExpanded)
        val targets=items.indices.filter { items[it].expanded || it in defaults }.toMutableSet()
        if(configuration.exclusive && targets.isNotEmpty()) { val first=targets.min();targets.clear();targets+=first }
        if(configuration.keepOneExpanded && targets.isEmpty()) items.indexOfFirst { !it.disabled }.takeIf { it>=0 }?.let { targets+=it }
        items.forEachIndexed { index,item->item.assignExpanded(index in targets) }
        synchronizePresentation()
        if(configuration.floating) { x=configuration.initialX;y=configuration.initialY;if(configuration.bringToFront) raise() }
    }
    fun synchronize(children:List<NativeAccordionItemState>) {
        require(children.distinct().size==children.size) { "An accordion item may occur only once in a group" }
        if(items.size!=children.size || items.zip(children).any { (a,b)->a!==b }) cancelReorder()
        items.filter { previous->children.none { it===previous } }.forEach { it.release(this) }
        items=children.toList()
        items.forEachIndexed { index,item->
            item.claim(this,index)
            if(originalOrder.none { it===item }) originalOrder+=item
        }
        if(loaded) { enforceExclusive();enforceKeepOne() }
        synchronizePresentation()
    }
    fun disconnect() { connected=false;cancelReorder();cancelChassis();items.forEach { it.release(this) } }
    fun update(next:NativeAccordionConfiguration) {
        val previous=configuration;configuration=next
        if(previous.floating!=next.floating) {
            cancelChassis();x=if(next.floating) next.initialX else 0.0;y=if(next.floating) next.initialY else 0.0
            if(!next.floating) zIndex=null
            items.forEachIndexed { index,item->if(owns(item)) item.claim(this,index) }
        }
        if(previous.reorderable && !next.reorderable) cancelReorder()
        if(previous.exclusive!=next.exclusive && next.exclusive) enforceExclusive()
        if(previous.keepOneExpanded!=next.keepOneExpanded) enforceKeepOne()
        if(previous.headingLevel!=next.headingLevel || previous.region!=next.region || previous.regionThreshold!=next.regionThreshold) synchronizePresentation()
    }
    private fun enforceExclusive() {
        if(!configuration.exclusive) return
        var kept=false
        items.forEach { if(owns(it) && it.expanded) { if(kept) it.assignExpanded(false) else kept=true } }
    }
    private fun enforceKeepOne() {
        val owned=items.filter(::owns)
        if(configuration.keepOneExpanded && owned.none { it.expanded }) owned.firstOrNull { !it.disabled }?.assignExpanded(true)
        synchronizeCollapsible()
    }
    private fun synchronizeCollapsible() {
        val owned=items.filter(::owns);val open=owned.filter { it.expanded }
        owned.forEach { it.collapsible=!configuration.keepOneExpanded || open.size!=1 || !it.expanded }
    }
    private fun synchronizePresentation() {
        val region=if(configuration.region=="always" || (configuration.region!="never" && items.size<=configuration.regionThreshold)) "region" else "group"
        items.forEachIndexed { index,item->if(owns(item)) { item.claim(this,index);item.headingLevel=configuration.headingLevel;item.regionRole=region } }
        synchronizeCollapsible()
    }
    fun itemToggled(item:NativeAccordionItemState,expanded:Boolean,index:Int) {
        if(!owns(item)) return
        if(configuration.exclusive && expanded) items.forEachIndexed { i,sibling->if(i!=index && owns(sibling)) sibling.assignExpanded(false) }
        synchronizeCollapsible()
        emit("mdToggle",mapOf("index" to index,"expanded" to expanded,"expandedIndices" to expandedIndices))
    }
    fun navigate(item:NativeAccordionItemState,direction:String,from:Int) {
        if(!owns(item)) return
        val enabled=items.indices.filter { owns(items[it]) && !items[it].disabled }
        if(enabled.isEmpty()) return
        val target=when(direction) {
            "first"->enabled.first();"last"->enabled.last()
            else->{ if(from !in items.indices) return
                if(direction=="next") enabled.firstOrNull { it>from } ?: enabled.first()
                else enabled.lastOrNull { it<from } ?: enabled.last()
            }
        }
        items[target].focusHeader()
    }
    fun keyboardReorder(item:NativeAccordionItemState,direction:String,from:Int) {
        if(!configuration.reorderable || !owns(item) || from !in items.indices || items[from].disabled) return
        val to=from+if(direction=="up") -1 else 1
        if(to !in items.indices) return
        move(from,to);items[to].focusHeader();emitReorder(from,to)
    }
    private fun move(from:Int,to:Int) {
        if(from==to) return
        items=items.toMutableList().apply { add(to,removeAt(from)) }
        items.forEachIndexed { index,item->if(owns(item)) item.claim(this,index) }
    }
    private fun emitReorder(from:Int,to:Int) { emit("mdReorder",mapOf("from" to from,"to" to to,"order" to originalIndices)) }
    fun beginReorder(item:NativeAccordionItemState,pointer:Int,button:Int=0,clientY:Double,hostTop:Double,rects:List<AccordionItemRect>):Boolean {
        if(!connected || button!=0 || !configuration.reorderable || reorder!=null || chassis!=null || !owns(item) || item.disabled || items.size<2 || rects.size!=items.size) return false
        val from=items.indexOfFirst { it===item };if(from<0) return false
        val distance=if(from<items.lastIndex) rects[from+1].top-rects[from].top else rects[from].top-rects[from-1].top
        reorder=AccordionReorder(item,pointer,from,from,clientY,hostTop,if(distance==0.0) rects[from].height else kotlin.math.abs(distance),rects.toList())
        draggedItemID=item.id;draggedOffset=0.0;dropPlaceholder=AccordionPlaceholder(rects[from].top-hostTop,rects[from].height)
        return true
    }
    fun moveReorder(pointer:Int,clientY:Double) {
        val drag=reorder?.takeIf { it.pointer==pointer } ?: return
        val dy=clientY-drag.startY;draggedOffset=dy
        val center=drag.rects[drag.from].top+drag.rects[drag.from].height/2+dy
        var target=drag.from
        if(dy>0) for(i in drag.from+1 until items.size) { if(center>drag.rects[i].top+drag.rects[i].height/2) target=i else break }
        else if(dy<0) for(i in drag.from-1 downTo 0) { if(center<drag.rects[i].top+drag.rects[i].height/2) target=i else break }
        if(target==drag.target) return
        reorder=drag.copy(target=target)
        siblingOffsets=buildMap {
            items.forEachIndexed { i,item->
                if(target>drag.from && i>drag.from && i<=target) put(item.id,-drag.distance)
                else if(target<drag.from && i<drag.from && i>=target) put(item.id,drag.distance)
            }
        }
        dropPlaceholder=AccordionPlaceholder(drag.rects[target].top-drag.hostTop,drag.rects[drag.from].height)
    }
    fun endReorder(pointer:Int,cancelled:Boolean=false) {
        val drag=reorder?.takeIf { it.pointer==pointer } ?: return
        cancelReorder()
        if(!cancelled && drag.target!=drag.from) { move(drag.from,drag.target);emitReorder(drag.from,drag.target) }
    }
    private fun cancelReorder() { reorder=null;draggedItemID=null;draggedOffset=0.0;siblingOffsets=emptyMap();dropPlaceholder=null }
    fun beginChassis(pointer:Int,button:Int=0,clientX:Double,clientY:Double):Boolean {
        if(!connected || button!=0 || !configuration.floating || reorder!=null || chassis!=null) return false
        chassis=AccordionChassisDrag(pointer,clientX,clientY,x,y);chassisDragging=true
        if(configuration.bringToFront) raise()
        emitDrag("mdDragStart",clientX,clientY,0.0,0.0);return true
    }
    fun moveChassis(pointer:Int,clientX:Double,clientY:Double) {
        val drag=chassis?.takeIf { it.pointer==pointer } ?: return
        val dx=clientX-drag.clientX;val dy=clientY-drag.clientY;x=drag.x+dx;y=drag.y+dy
        emitDrag("mdDragMove",clientX,clientY,dx,dy)
    }
    /** Pointer cancellation follows the source end path, retaining the last
     * rendered position and reporting the terminal pointer's delta separately. */
    fun endChassis(pointer:Int,clientX:Double,clientY:Double) {
        val drag=chassis?.takeIf { it.pointer==pointer } ?: return
        cancelChassis();emitDrag("mdDragEnd",clientX,clientY,clientX-drag.clientX,clientY-drag.clientY)
    }
    private fun cancelChassis() { chassis=null;chassisDragging=false }
    private fun raise() { zIndex=++floatingZ }
    private fun emitDrag(name:String,clientX:Double,clientY:Double,dx:Double,dy:Double) {
        emit(name,mapOf("clientX" to clientX,"clientY" to clientY,"x" to x,"y" to y,"dx" to dx,"dy" to dy))
    }
    companion object {
        private var floatingZ=1000
        private val decimal=Regex("^[+-]?(?:[0-9]+\\.?[0-9]*|\\.[0-9]+)(?:[eE][+-]?[0-9]+)?$")
        private val hex=Regex("^0x[0-9a-f]+$")
        private val binary=Regex("^0b[01]+$")
        private val octal=Regex("^0o[0-7]+$")
        private const val sourceWhitespace="\u0009\u000A\u000B\u000C\u000D\u0020\u00A0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF"
        fun defaultIndices(source:String):Set<Int> = source.split(',').mapNotNull { piece->
            val text=piece.trim { it in sourceWhitespace };val lower=text.lowercase()
            val number=when {
                hex.matches(lower)->text.drop(2).toULongOrNull(16)?.toDouble()
                binary.matches(lower)->text.drop(2).toULongOrNull(2)?.toDouble()
                octal.matches(lower)->text.drop(2).toULongOrNull(8)?.toDouble()
                decimal.matches(text)->text.toDoubleOrNull()
                else->null
            }
            number?.takeIf { it.isFinite() && it>=0 && it==kotlin.math.floor(it) && it<Int.MAX_VALUE }?.toInt()
        }.toSet()
    }
}
