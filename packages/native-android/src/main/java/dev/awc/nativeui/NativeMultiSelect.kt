package dev.awc.nativeui

import android.animation.ValueAnimator
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.focusable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.hoverable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.interaction.collectIsHoveredAsState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.input.key.*
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.PointerInputChange
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.layout.IntrinsicMeasurable
import androidx.compose.ui.layout.IntrinsicMeasureScope
import androidx.compose.ui.layout.Measurable
import androidx.compose.ui.layout.MeasurePolicy
import androidx.compose.ui.layout.MeasureResult
import androidx.compose.ui.layout.MeasureScope
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.*
import androidx.compose.ui.layout.layout
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.max
import kotlin.math.roundToInt

/** A CSS `font` shorthand subset (`italic 500 15px Roboto`, `400 14px/20px Roboto`). */
@Immutable data class AWCMultiSelectFont(val italic:Boolean=false,val weight:Int=400,val size:Double=14.0,val line:Double?=null) {
    companion object {
        fun parse(css:String):AWCMultiSelectFont? { var f=AWCMultiSelectFont();var found=false
            for(t in css.trim().split(Regex("\\s+"))) when {
                t=="italic"->f=f.copy(italic=true)
                t.toIntOrNull()?.let { it in 100..900 }==true->f=f.copy(weight=t.toInt())
                t.contains("px")->{ val parts=t.split("/").map { it.replace("px","").toDoubleOrNull() }
                    parts.firstOrNull()?.let { f=f.copy(size=it);found=true };parts.getOrNull(1)?.let { f=f.copy(line=it) } } }
            return if(found) f else null }
    }
}
/** The md-multi-select hooks (`--md-multi-select-*`); lengths are dp (= CSS px), colours `#RRGGBB[AA]`; paddings are CSS
 *  shorthands resolved to (top, end, bottom, start). */
@Immutable data class AWCMultiSelectAppearance(val css:Map<String,String> = emptyMap()) {
    private fun raw(k:String)=(css["--md-multi-select-$k"] ?: css[k])?.trim()?.takeIf { it.isNotEmpty() }
    private fun px(k:String)=raw(k)?.replace("px","")?.trim()?.toDoubleOrNull()?.takeIf { it>=0 }
    private fun c(k:String)=raw(k)?.takeIf { Regex("^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$").matches(it) }
    private fun box(k:String):List<Double>? { val n=raw(k)?.split(Regex("\\s+"))?.mapNotNull { it.replace("px","").toDoubleOrNull() } ?: return null
        return when(n.size) { 1->listOf(n[0],n[0],n[0],n[0]);2->listOf(n[0],n[1],n[0],n[1]);3->listOf(n[0],n[1],n[2],n[1]);4->n;else->null } }
    val width get()=px("width");val minWidth get()=px("min-width");val triggerWidth get()=px("trigger-width");val frameGap get()=px("frame-gap")
    val chipGap get()=px("chip-gap");val chipHeight get()=px("chip-height");val chipRadius get()=px("chip-radius");val chipOutline get()=c("chip-outline")
    val caretColor get()=c("caret-color");val caretSize get()=px("caret-size");val caretBoxSize get()=px("caret-box-size")
    val clearColor get()=c("clear-color");val clearBackground get()=c("clear-bg");val clearHoverBackground get()=c("clear-hover-bg");val clearSize get()=px("clear-size")
    val clearIconSize get()=px("clear-icon-size");val clearRadius get()=px("clear-radius");val clearFocusRingColor get()=c("clear-focus-ring-color")
    val clearFocusRingWidth get()=px("clear-focus-ring-width");val clearFocusRingOffset get()=px("clear-focus-ring-offset")
    val optionIconColor get()=c("option-icon-color");val optionIconSize get()=px("option-icon-size")
    val searchBackground get()=c("search-bg");val searchColor get()=c("search-color");val searchPlaceholderColor get()=c("search-placeholder-color")
    val searchBorderColor get()=c("search-border-color");val searchBorderWidth get()=px("search-border-width");val searchPadding get()=box("search-padding")
    val selectAllDividerColor get()=c("select-all-divider-color");val selectAllDividerWidth get()=px("select-all-divider-width")
    val emptyColor get()=c("empty-color");val emptyPadding get()=box("empty-padding");val emptyFont get()=raw("empty-font")?.let(AWCMultiSelectFont::parse)
    val loadingPadding get()=px("loading-padding");val loaderSize get()=px("loader-size");val spinnerSize get()=px("spinner-size")
    val inlineChipsBlockStart get()=px("inline-chips-block-start")
    /** Also takes the hook map without the prefix (`mapOf("chip-height" to "28px")`); merging normalizes the keys. */
    fun merge(o:AWCMultiSelectAppearance)=AWCMultiSelectAppearance(long(css)+long(o.css))
    private fun long(m:Map<String,String>)=m.mapKeys { (k,_)-> if(k.startsWith("--")) k else "--md-multi-select-$k" }
    companion object {
        /** CSS custom properties as authored on the host (`--md-multi-select-chip-height: 28px`). */
        fun fromCss(css:Map<String,String>)=AWCMultiSelectAppearance(css.filterKeys { it.startsWith("--md-multi-select-") })
        /** Typed values (Laboratory): camelCase hook names (`chipHeight`, `clearBackground`, `searchPadding` as a number or list). */
        fun fromValues(v:Map<String,AWCValue>):AWCMultiSelectAppearance { val out=mutableMapOf<String,String>()
            for((k,x) in v) { val name=k.replace("Background","Bg").replace(Regex("([A-Z])")) { "-"+it.value.lowercase() }
                out["--md-multi-select-$name"]=when(x) { is Number->"${x}px";is String->x;is List<*>->x.joinToString(" ") { "${it}px" };else->continue } }
            return AWCMultiSelectAppearance(out) }
    }
}
internal val LocalAWCMultiSelectAppearance=staticCompositionLocalOf { AWCMultiSelectAppearance() }
@Composable fun AWCMultiSelectAppearanceScope(appearance:AWCMultiSelectAppearance,content:@Composable ()->Unit)=
    CompositionLocalProvider(LocalAWCMultiSelectAppearance provides LocalAWCMultiSelectAppearance.current.merge(appearance),content=content)

/** md-multi-select methods. Attach with [AWCMultiSelectControllerScope]. */
class AWCMultiSelectController {
    internal var runtime:AWCMultiSelectRuntime?=null
    val isConnected get()=runtime!=null
    fun show() { runtime?.show?.invoke() }
    fun close() { runtime?.close?.invoke() }
    fun focusTrigger() { runtime?.field?.setFocus() }
    fun reset() { runtime?.reset?.invoke() }
    fun getValidity():AWCConstraintValidity=runtime?.validityNow ?: AWCConstraintValidity.VALID
    fun checkValidity():Boolean=runtime?.validityNow?.valid ?: true
    fun reportValidity():Boolean { val r=runtime ?: return true;if(r.validityNow.valid) return true;r.revealed=true;r.field.setFocus();return false }
    fun setCustomValidity(message:String) { runtime?.customMessage=message }
    /** Filters the menu as typing into its search field would. */
    fun setQuery(query:String) { runtime?.query=query }
    /** Replaces the programmatic options (native lists are not virtualized). */
    fun loadOptions(options:List<AWCValue>) { runtime?.loaded=options.mapNotNull(AWCSelectOptions::init) }
    fun getLabels(values:List<String>):Map<String,String> { val o=runtime?.optionsNow.orEmpty();return values.mapNotNull { v-> o.firstOrNull { it.value==v }?.let { v to it.label } }.toMap() }
}
internal val LocalAWCMultiSelectController=staticCompositionLocalOf<AWCMultiSelectController?> { null }
@Composable fun AWCMultiSelectControllerScope(controller:AWCMultiSelectController,content:@Composable ()->Unit)=CompositionLocalProvider(LocalAWCMultiSelectController provides controller,content=content)

internal class AWCMultiSelectRuntime {
    val field=AWCTextFieldController()
    var query by mutableStateOf("")
    var loaded by mutableStateOf<List<AWCSelectOptionData>?>(null)
    var customMessage by mutableStateOf("")
    var revealed by mutableStateOf(false)
    var focused by mutableStateOf(false)
    var searchFocus by mutableIntStateOf(0)
    var inlineStart by mutableFloatStateOf(0f)
    var trailingStart by mutableFloatStateOf(0f)
    var lastEmit:String?=null
    var lastValidityKey:String?=null
    var openedByKey=false
    var menuSynced=false
    var validityNow=AWCConstraintValidity.VALID
    var optionsNow:List<AWCSelectOptionData> = emptyList()
    var show:()->Unit={};var close:()->Unit={};var reset:()->Unit={}
}

/** Value of md-multi-select: a list, else a JSON array string, else one value. */
internal fun awcMultiValue(v:AWCValue):List<String> = when(v) {
    null->emptyList()
    is String->if(v.isEmpty()) emptyList() else runCatching { awcList(org.json.JSONArray(v)).map { it.toString() } }.getOrDefault(listOf(v))
    else->awcList(v).map { it.toString() }
}

/**
 * md-multi-select: a read-only md-text-field (or a compact md-button) trigger, the selection as md-chip tokens beside it (or
 * inside the field), and an md-menu listbox of checkbox option rows with the search field and "Select all" row pinned in its
 * header — composed from the library's own renderers as the source composes its primitives. The menu presents in the
 * nearest [AWCMenuScope].
 */
@Composable internal fun NativeMultiSelect(p:Props,onEvent:EventSink,controlEvent:EventSink,slot:Slot?,formField:AWCFormField?,form:AWCFormState?) {
    val generated=remember { "multi-"+java.util.UUID.randomUUID().toString().take(8) }
    val id=p.str("id").ifEmpty { generated }
    var value by awcState(p["value"]) { awcMultiValue(p["value"]) }
    var open by awcState(p["open"]) { p.bool("open") }
    val rt=remember { AWCMultiSelectRuntime() }
    val controller=LocalAWCMultiSelectController.current
    val registry=LocalNativeMenuRegistry.current
    val tokens=LocalAWCThemeTokens.current
    val a=LocalAWCMultiSelectAppearance.current
    val inspection=LocalAWCInspection.current
    val selectInspection=LocalAWCSelectInspection.current
    val reduced=LocalAWCFieldReducedMotion.current ?: !ValueAnimator.areAnimatorsEnabled()
    val rtl=LocalLayoutDirection.current==LayoutDirection.Rtl
    val disabled=p.bool("disabled");val isDisabled=disabled || p.bool("softDisabled")
    val emit:(String,Any?)->Unit={ n,d-> selectInspection?.events?.add(Triple(n,id,d));controlEvent(n,d) }
    val collector=remember { AWCSelectOptionCollector() }
    Box(Modifier.size(0.dp)) { CompositionLocalProvider(LocalAWCSelectOptions provides collector) { slot?.invoke("") } }
    val slotted=collector.options
    val options=rt.loaded ?: if(slotted.isNotEmpty()) slotted.filter { !it.hidden } else AWCSelectOptions.inits(p["options"])
    val selected=value.mapNotNull { v-> options.firstOrNull { it.value==v } }
    val displayMode=p.str("displayMode").takeIf { it in listOf("chips","chips-inline","count","text") } ?: "chips"
    val chipOverflow=if(p.str("chipOverflow")=="wrap") "wrap" else "count"
    val buttonTrigger=p.str("trigger")=="button"
    val inline=!buttonTrigger && displayMode=="chips-inline"
    val positioned=buttonTrigger || displayMode=="chips"
    val position=if(positioned) (p.str("chipPosition").takeIf { it in listOf("bottom","top","left","right") } ?: "bottom") else "bottom"
    val sideways=position=="left" || position=="right"
    val accessibleName=p.str("label").ifEmpty { p.str("aria-label").ifEmpty { p.str("ariaLabel") } }.trim()
    val validity=when { rt.customMessage.isNotEmpty()->AWCConstraintValidity.of("customError",rt.customMessage)
        p.bool("required") && value.isEmpty()->AWCConstraintValidity.of("valueMissing",p.str("valueMissingLabel","Please select at least one option")); else->AWCConstraintValidity.VALID }
    val validationMessage=if(rt.revealed && !validity.valid) validity.validationMessage else ""
    val density=(p["density"] as? Number)?.toDouble()
    val rung=density?.takeIf { it in listOf(-1.0,-2.0,-3.0,-4.0) } ?: LocalAWCNativeDensity.current
    val insetLG=if(rung<=-4) 8.0 else if(rung<=-2) 12.0 else 16.0
    val tint=tokens["--md-sys-color-on-surface-variant"] ?: "#49454F"
    val outlineVariant=tokens["--md-sys-color-outline-variant"] ?: "#CAC4D0"
    val anchorID="$id::trigger";val menuID="$id::menu"
    rt.validityNow=validity;rt.optionsNow=options
    LaunchedEffect(validity.key) { val k=validity.key;val last=rt.lastValidityKey;rt.lastValidityKey=k;if(last!=null && last!=k) emit("mdValidityChange",validity.eventValue) }
    val inlineVisible=remember { mutableIntStateOf(Int.MAX_VALUE) }
    // Focus after a chip's removal (the source focuses the next chip's remove button, else the trigger), and which chip has
    // focus (test inspection).
    val chipRequesters=remember { mutableMapOf<Int,FocusRequester>() }
    val chipFocus=remember { mutableStateMapOf<Int,Boolean>() }
    var focusChipAfter by remember { mutableStateOf<Int?>(null) }
    LaunchedEffect(focusChipAfter) { val k=focusChipAfter ?: return@LaunchedEffect;withFrameNanos { }
        if(k<0) rt.field.setFocus() else runCatching { chipRequesters[k]?.requestFocus() };focusChipAfter=null }
    val focusedNow=rt.focused
    val chipFocusedNow=chipFocus.values.any { it }
    SideEffect {
        controller?.runtime=rt
        rt.show={ if(!isDisabled) open=true };rt.close={ open=false };rt.reset={ if(value.isNotEmpty()) { value=emptyList();emit("mdChange",emptyList<String>()) } }
        selectInspection?.states?.set(id,mapOf("open" to open,"value" to value,"focused" to focusedNow,"chipFocused" to chipFocusedNow,"valid" to validity.valid))
    }
    LaunchedEffect(open,registry) {
        val r=registry ?: return@LaunchedEffect
        if(!rt.menuSynced) { withFrameNanos { };rt.menuSynced=true }
        var c=r.controllers[menuID];var tries=0
        while(c==null && tries<20) { withFrameNanos { };c=r.controllers[menuID];tries++ }
        c ?: return@LaunchedEffect
        if(open) { if(!c.isOpen || c.closing) c.show(!p.bool("filterable"),rt.openedByKey) } else if(c.isOpen && !c.closing) c.close()
        rt.openedByKey=false
    }
    fun syncMenuNow(o:Boolean,keyboard:Boolean) { val c=registry?.controllers?.get(menuID) ?: return;rt.menuSynced=true
        if(o) { if(!c.isOpen || c.closing) c.show(!p.bool("filterable"),keyboard) } else if(c.isOpen && !c.closing) c.close() }
    fun commit(next:List<String>) { value=next;emit("mdChange",next) }
    fun toggleValue(v:String) { if(isDisabled) return;val has=v in value;val max=(p["maxSelected"] as? Number)?.toInt() ?: 0
        if(!has && max>0 && value.size>=max) return;commit(if(has) value-v else value+v) }
    fun removeValue(v:String) { if(isDisabled || v !in value) return;val removed=selected.indexOfFirst { it.value==v };val next=value-v;value=next;emit("mdRemove",v);emit("mdChange",next)
        val remaining=next.count { x-> options.any { it.value==x } };focusChipAfter=if(remaining==0) -1 else minOf(removed,remaining-1) }
    fun clear() { if(isDisabled || value.isEmpty()) return;value=emptyList();emit("mdChange",emptyList<String>());emit("mdClear",null);rt.field.setFocus() }
    val eligible=options.filter { !it.disabled }.map { it.value }
    fun toggleSelectAll() { if(isDisabled) return;val max=(p["maxSelected"] as? Number)?.toInt() ?: 0
        val all=eligible.isNotEmpty() && eligible.all { it in value };commit(if(all) emptyList() else eligible.take(if(max>0) max else eligible.size)) }
    val showClear=p.bool("clearable") && selected.isNotEmpty() && !isDisabled
    val clearBounds=remember { arrayOfNulls<Rect>(1) }
    val fieldOrigin=remember { arrayOf(Offset.Zero) }
    val caretTurn=remember { Animatable(if(open) 1f else 0f) }
    LaunchedEffect(open,reduced) { val t=if(open) 1f else 0f;if(reduced) caretTurn.snapTo(t) else caretTurn.animateTo(t,tween(200,easing=CubicBezierEasing(.2f,0f,0f,1f))) }
    // --md-sys-spacing-gap-xs (the chip gap's fallback): 2 on the −4 rung.
    val chipGap=a.chipGap ?: if(rung<=-4) 2.0 else 4.0
    val chipAppearance=AWCChipHookAppearance(containerShape=awcUniformCorners(a.chipRadius ?: 8.0),containerHeight=a.chipHeight ?: 32.0,outlineColor=a.chipOutline ?: outlineVariant)
    @Composable fun Chip(o:AWCSelectOptionData,k:Int,prefix:String,modifier:Modifier=Modifier) {
        val focusable=prefix=="chip"
        Box(modifier.then(if(focusable) Modifier.focusRequester(chipRequesters.getOrPut(k) { FocusRequester() }).onFocusChanged { chipFocus[k]=it.hasFocus } else Modifier)) { AWCComponent("md-chip",mapOf("id" to "$id::$prefix$k","variant" to "input","selectable" to false,"label" to o.label,"disabled" to isDisabled,"removable" to !isDisabled),
            onEvent={ n,_-> if(n=="mdRemove") removeValue(o.value) }) }
    }
    @Composable fun OverflowChip(n:Int,modifier:Modifier=Modifier,interactive:Boolean=true) {
        val shape=RoundedCornerShape((a.chipRadius ?: 8.0).dp)
        Box(modifier.height((a.chipHeight ?: 32.0).dp).border(1.dp,awcColor(a.chipOutline ?: outlineVariant,Color.Gray),shape)
            .then(if(interactive) Modifier.clickable { if(!isDisabled) { open=!open;syncMenuNow(open,false) } }.semantics { contentDescription="$n more selected — open to manage" } else Modifier)
            .padding(horizontal=13.dp),contentAlignment=Alignment.Center) {
            // Chrome renders the label in the inherited 16 px / 400 Roboto: the source's `font` shorthand (var() fallbacks with
            // commas) is invalid at computed-value time.
            BasicText("+$n",style=TextStyle(fontFamily=MultiRoboto,fontWeight=FontWeight.Normal,fontSize=16.sp,lineHeight=19.sp,color=awcColor(tint,Color.Black)),maxLines=1,softWrap=false)
        }
    }
    // Chips outside the field (display-mode="chips" / the button trigger): a wrapping row, gap chip-gap.
    val chips:@Composable ()->Unit={
        AWCChipAppearanceScope(chipAppearance) {
            // Bottom / top: a block-level flex row (the full frame width); left / right: flex 0 1 auto beside the trigger.
            AWCMultiChipsFlow(chipGap,chipGap,true,Modifier.then(if(sideways) Modifier else Modifier.fillMaxWidth()).inspectAWCNode(inspection,"chips","chips")) {
                selected.forEachIndexed { k,o-> key(o.value) { Chip(o,k,"chip",Modifier.inspectAWCNode(inspection,"chip-$k","chip")) } }
            }
        }
    }
    val inlineChips:@Composable ()->Unit={
        val wrap=chipOverflow=="wrap"
        val d=LocalDensity.current.density
        // The display row runs from its start to the trailing cluster (flex 1 1 auto in the field's chip area).
        val avail=if(rt.inlineStart!=0f && rt.trailingStart!=0f) ((if(rtl) rt.inlineStart-rt.trailingStart else rt.trailingStart-rt.inlineStart)/d-4f).takeIf { it>0 } else null
        AWCChipAppearanceScope(chipAppearance) {
            // The inspected box includes the block-start padding (Chrome's border box).
            Box(Modifier.inspectAWCNode(inspection,"chips","chips").padding(top=if(wrap) (a.inlineChipsBlockStart ?: 4.0).dp else 0.dp).then(if(avail!=null) Modifier.width((if(wrap) avail+4f else avail).dp) else Modifier)
                .onGloballyPositioned { val b=it.boundsInRoot();rt.inlineStart=if(rtl) b.right else b.left }.then(if(wrap) Modifier else Modifier.clipToBounds())) {
                if(wrap) AWCMultiChipsFlow(chipGap,chipGap,true) { selected.forEachIndexed { k,o-> key(o.value) { Chip(o,k,"chip",Modifier.inspectAWCNode(inspection,"chip-$k","chip")) } } }
                else {
                    // Intrinsic chip widths (hidden "+total" measure chip included), then as many leading chips as fit with a
                    // "+N" chip; the count settles after layout, as the source's ResizeObserver pass does.
                    val holder=remember { intArrayOf(selected.size) }
                    val visible=inlineVisible.intValue.coerceAtMost(selected.size)
                    Layout({
                        selected.forEachIndexed { k,o-> key(o.value) { Chip(o,k,"chip",if(k<visible) Modifier.inspectAWCNode(inspection,"chip-$k","chip") else Modifier) } }
                        OverflowChip(selected.size,interactive=false)
                        OverflowChip(max(1,selected.size-visible),if(visible<selected.size) Modifier.inspectAWCNode(inspection,"overflow-chip","overflow-chip") else Modifier)
                    },Modifier.onGloballyPositioned { if(inlineVisible.intValue!=holder[0]) inlineVisible.intValue=holder[0] }) { ms,c->
                        val n=selected.size;val chipsP=ms.take(n).map { it.measure(Constraints()) }
                        val plusMeasure=ms[n].measure(Constraints());val plusShown=ms[n+1].measure(Constraints())
                        val gapPx=chipGap*d
                        val availPx=if(c.hasBoundedWidth) c.maxWidth.toDouble() else avail?.let { it*d.toDouble() } ?: Double.MAX_VALUE
                        val sumAll=chipsP.withIndex().sumOf { it.value.width+(if(it.index>0) gapPx else 0.0) }
                        val fit=if(sumAll<=availPx+.5*d) n else { val budget=availPx-plusMeasure.width-gapPx;var used=0.0;var k=0
                            for((i,pl) in chipsP.withIndex()) { val add=pl.width+(if(i>0) gapPx else 0.0);if(used+add<=budget) { used+=add;k++ } else break };k }
                        holder[0]=fit
                        val shown=chipsP.take(visible)+(if(visible<n) listOf(plusShown) else emptyList())
                        val w=if(availPx<Double.MAX_VALUE/2) availPx.roundToInt() else shown.sumOf { it.width }+(gapPx*max(0,shown.size-1)).roundToInt()
                        val h=(chipsP+plusShown).maxOfOrNull { it.height } ?: 0
                        layout(w,h) { var x=0.0
                            for(pl in shown) { val px=if(rtl) w-x-pl.width else x;pl.place(px.roundToInt(),(h-pl.height)/2);x+=pl.width+gapPx } }
                    }
                }
            }
        }
    }
    val trailing:@Composable ()->Unit={
        val turn=caretTurn.value
        SideEffect { selectInspection?.states?.set("$id::caret",mapOf("rotation" to turn.toDouble())) }
        Box(Modifier.onGloballyPositioned { val b=it.boundsInRoot();rt.trailingStart=if(rtl) b.right else b.left }) {
            if(p.bool("loading")) Box(Modifier.size((a.loaderSize ?: 24.0).dp).inspectAWCNode(inspection,"loading-spinner","loading-spinner"),contentAlignment=Alignment.Center) {
                val size=a.spinnerSize ?: 22.0
                AWCLoadingIndicatorAppearanceScope(AWCLoadingIndicatorAppearance(size=size,shapeSize=size)) {
                    SelectSlotOr(slot,"loader") { AWCComponent("md-loading-indicator",mapOf("label" to p.str("loadingText","Loading…"))) } }
            } else Row(verticalAlignment=Alignment.CenterVertically) {
                if(showClear) MultiClearButton(a,tint,tokens,p.str("clearIcon","close"),p.str("clearLabel","Clear selection"),
                    Modifier.onGloballyPositioned { clearBounds[0]=it.boundsInRoot() }.inspectAWCNode(inspection,"clear","clear")) { clear() }
                val box=a.caretBoxSize ?: 24.0;val size=a.caretSize ?: 24.0
                Box(Modifier.size(box.dp).inspectAWCNode(inspection,"caret-box","caret-box").inspectAWCNode(inspection,"caret","caret").rotate(180f*turn),contentAlignment=Alignment.Center) {
                    CompositionLocalProvider(androidx.compose.material3.LocalContentColor provides awcColor(a.caretColor ?: tint,Color.Black)) {
                        SelectSlotOr(slot,"dropdown-icon") { AWCMaterialSymbol(p.str("dropdownIcon","arrow_drop_down"),size=size.dp) } }
                }
            }
        }
    }
    val fieldTrigger:@Composable ()->Unit={
        val displayValue=if(inline) "" else if(displayMode=="text" && selected.isNotEmpty()) selected.joinToString(", ") { it.label } else if(value.isEmpty()) "" else "${value.size} selected"
        val hooks=AWCFieldHooks(focus={ f-> rt.focused=f },trailing=trailing,controller=rt.field,event={ _,_-> })
        val fieldProps:Props=buildMap {
            put("variant",p.str("variant","outlined"));put("label",p.str("label"));if(p.str("label").isEmpty() && accessibleName.isNotEmpty()) put("aria-label",accessibleName)
            put("placeholder",if(selected.isNotEmpty()) "" else p.str("placeholder"));put("readOnly",true);put("disabled",disabled);put("required",p.bool("required"))
            put("error",p.bool("error") || validationMessage.isNotEmpty());put("errorText",p.str("errorText").ifEmpty { validationMessage })
            put("reserveSupportingSpace",p.bool("reserveSupportingSpace"));put("supportingText",p.str("supportingText"))
            if(sideways) put("density",-3.0) else if(density!=null) put("density",density)
            put("appearFocused",open);put("value",displayValue);put("chipsWrap",inline && chipOverflow=="wrap")
        }
        // Chrome's max-content width of a density −3 md-text-field (a size-20 input), for the left / right chip positions.
        val width=if(sideways) (a.triggerWidth ?: (213.0+(if(showClear) a.clearSize ?: 28.0 else 0.0)+((a.caretBoxSize ?: 24.0)-24.0))) else null
        AWCTextFieldAppearanceScope(AWCTextFieldAppearance(paddingInlineEnd=insetLG)) {
            Box(Modifier.then(if(width!=null) Modifier.width(width.dp) else Modifier.fillMaxWidth()).awcMenuAnchor(anchorID,null).inspectAWCNode(inspection,"field","field")
                .onGloballyPositioned { fieldOrigin[0]=it.boundsInRoot().topLeft }
                .pointerInput(isDisabled,showClear) { awaitEachGesture {
                    val down=awaitFirstDown(false,PointerEventPass.Initial)
                    var up:PointerInputChange?=null
                    while(true) { val e=awaitPointerEvent(PointerEventPass.Initial);val c=e.changes.firstOrNull { it.id==down.id } ?: break;if(!c.pressed) { up=c;break } }
                    val u=up ?: return@awaitEachGesture
                    val inside=u.position.x>=0 && u.position.y>=0 && u.position.x<size.width && u.position.y<size.height
                    val clearHit=showClear && clearBounds[0]?.contains(fieldOrigin[0]+down.position)==true
                    if(inside && !isDisabled && !clearHit && !u.isConsumed) { open=!open;syncMenuNow(open,false) } } }
                .onPreviewKeyEvent { e-> if(e.type!=KeyEventType.KeyDown || isDisabled) false else when(e.key) {
                    Key.DirectionDown,Key.DirectionUp,Key.Enter,Key.NumPadEnter,Key.Spacebar-> if(!open) { registry?.inputTime=e.nativeKeyEvent.eventTime.toDouble();open=true;syncMenuNow(true,true);true } else false
                    Key.Escape-> if(open) { registry?.inputTime=e.nativeKeyEvent.eventTime.toDouble();open=false;rt.field.setFocus();true } else false
                    else->false } }) {
                CompositionLocalProvider(LocalAWCInspection provides inspection?.copy(id=anchorID,entered=true,parentId=inspection.id)) {
                    NativeTextField(fieldProps,{ _,_-> },{ _,_-> },{ name-> if(name=="chips" && inline && selected.isNotEmpty()) inlineChips() },null,null,hooks) }
            }
        }
    }
    val buttonTrigger_:@Composable ()->Unit={
        val err=(p.bool("error") || validationMessage.isNotEmpty()) && p.str("errorText").ifEmpty { validationMessage }.isNotEmpty()
        val message=if(err) p.str("errorText").ifEmpty { validationMessage } else p.str("supportingText")
        Column(Modifier.fillMaxWidth()) {
            Box(Modifier.fillMaxWidth().awcMenuAnchor(anchorID,null).inspectAWCNode(inspection,"field","field")) {
                AWCComponent("md-button",mapOf("variant" to "outlined","size" to "xs","icon" to p.str("triggerIcon","add"),"loading" to p.bool("loading"),"disabled" to isDisabled,
                    "fullWidth" to true,"label" to p.str("triggerLabel").ifEmpty { p.str("label") }),onEvent={ n,_-> if(n=="mdClick" && !isDisabled) open=!open })
            }
            if(message.isNotEmpty()) BasicText(message,Modifier.padding(top=4.dp,start=16.dp,end=16.dp).inspectAWCNode(inspection,"button-desc","button-desc"),
                style=TextStyle(fontFamily=MultiRoboto,fontSize=12.sp,lineHeight=16.sp,color=awcColor(if(err) tokens["--md-sys-color-error"] ?: "#B3261E" else tint,Color.Black)))
        }
    }
    val trigger:@Composable ()->Unit={ if(buttonTrigger) buttonTrigger_() else fieldTrigger() }
    val gap=a.frameGap ?: max(6.0,8.0+(density ?: 0.0)*.5)
    val topGap=a.frameGap ?: max(6.0,16.0+(density ?: 0.0)*2.5)
    val showChips=positioned && selected.isNotEmpty()
    val minW=a.minWidth ?: 200.0
    val host=Modifier.let { if(a.width!=null) it.width(maxOf(a.width!!,minW).dp) else it.fillMaxWidth() }.widthIn(min=minW.dp)
    Column(host) {
        Box(Modifier.fillMaxWidth().inspectAWCNode(inspection,"frame","frame")) {
            // The polite live region (`part=live-region`): "N selected" / "None selected", announced on every change.
            // As Web: the region is unnamed and its text is the message; empty (nothing selected yet) it has nothing to read (6-7).
            var everSelected by remember { mutableStateOf(false) }
            if(value.isNotEmpty()) everSelected=true
            val liveText=if(value.isNotEmpty()) "${value.size} selected" else if(everSelected) "None selected" else ""
            if(liveText.isNotEmpty()) Box(Modifier.layout { m,_-> val pl=m.measure(androidx.compose.ui.unit.Constraints.fixed(1,1));layout(0,0) { pl.place(0,0) } }
                .semantics { liveRegion=LiveRegionMode.Polite }) {
                androidx.compose.material3.Text(liveText,Modifier.fillMaxSize(),color=androidx.compose.ui.graphics.Color.Transparent,fontSize=1.sp,maxLines=1,softWrap=false)
            }
            when(position) {
                "top"->Column(verticalArrangement=Arrangement.spacedBy(topGap.dp)) { if(showChips) chips();trigger() }
                "left","right"->Row(horizontalArrangement=Arrangement.spacedBy(gap.dp),verticalAlignment=Alignment.CenterVertically) {
                    if(showChips && position=="left") Box(Modifier.weight(1f,fill=false)) { chips() }
                    trigger()
                    if(showChips && position=="right") Box(Modifier.weight(1f,fill=false)) { chips() } }
                else->Column(verticalArrangement=Arrangement.spacedBy(gap.dp)) { trigger();if(showChips) chips() }
            }
        }
        val q=if(p.bool("filterable")) rt.query.trim().lowercase() else ""
        val listOptions=if(q.isEmpty()) options else options.filter { it.label.lowercase().contains(q) || it.supportingText.lowercase().contains(q) }
        val showNoOptions=!p.bool("loading") && q.isEmpty() && options.isEmpty()
        val showNoResults=!p.bool("loading") && q.isNotEmpty() && listOptions.isEmpty()
        CompositionLocalProvider(LocalNativeMenuCollector provides inspection?.collector) {
        AWCComponent("md-menu",buildMap { put("id",menuID);put("anchor",anchorID);put("placement",p.str("placement","bottom-start"));put("matchAnchorWidth",p.bool("matchTriggerWidth",true))
                put("emptyText","");if(registry==null) put("open",open);put("autoFocus",!p.bool("filterable"));put("listbox",true);put("listLabel",accessibleName.ifEmpty { "Options" });p["maxHeight"]?.let { put("maxHeight",it) }
                if(density!=null) put("density",density) },
            onEvent={ n,_-> when(n) { "mdOpen"->{ if(!open) open=true;if(rt.lastEmit!="open") { rt.lastEmit="open";emit("mdOpen",null) };if(p.bool("filterable")) rt.searchFocus++ }
                "mdClose"->{ if(open) open=false;if(rt.query.isNotEmpty()) rt.query="";if(rt.lastEmit!="close") { rt.lastEmit="close";emit("mdClose",null) } } } }) { s->
            when(s) {
                ""-> if(!p.bool("loading")) listOptions.forEachIndexed { i,o-> key(o.value) {
                    AWCComponent("md-menu-item",mapOf("id" to "$id::opt$i","presentation" to "option","type" to "checkbox","checkPosition" to "start","keepOpen" to true,"disabled" to o.disabled,
                        "selected" to (o.value in value),"headline" to o.label,"supportingText" to o.supportingText),
                        onEvent={ n,_-> if(n=="mdClick") toggleValue(o.value) }) { rs->
                        if(rs=="leading-icon" && o.icon.isNotEmpty()) CompositionLocalProvider(androidx.compose.material3.LocalContentColor provides
                            awcColor(o.iconColor.ifEmpty { a.optionIconColor ?: tint },Color.Black)) {
                            // The 20 px glyph centred in the row's 24 px slot (Chrome's inline-flex slot box); measured as the glyph.
                            val optCtx=remember(inspection?.collector,i) { inspection?.collector?.let { AWCInspectionContext(it,"$id::opt$i",true,"$id::opt$i") } }
                            AWCMaterialSymbol(o.icon,modifier=Modifier.inspectAWCNode(optCtx,"option-icon","option-icon"),size=(a.optionIconSize ?: 20.0).dp) }
                    } } }
                "header"-> Column(Modifier.fillMaxWidth()) {
                    if(p.bool("filterable") && !p.bool("loading")) MultiSearchField(rt,p,a,tokens,inspection)
                    if(p.bool("showSelectAll") && !p.bool("loading") && options.isNotEmpty()) {
                        val all=eligible.isNotEmpty() && eligible.all { it in value };val some=!all && eligible.any { it in value }
                        Column(Modifier.fillMaxWidth().inspectAWCNode(inspection,"select-all","select-all")) {
                            Box(Modifier.fillMaxWidth().inspectAWCNode(inspection,"select-all-item","select-all-item")) {
                                AWCComponent("md-menu-item",mapOf("id" to "$id::selectAll","type" to "checkbox","checkPosition" to "start","roleOverride" to "checkbox","keepOpen" to true,
                                    "headline" to p.str("selectAllLabel","Select all"),"selected" to all,"indeterminate" to some,"disabled" to isDisabled),onEvent={ n,_-> if(n=="mdClick") toggleSelectAll() }) }
                            Box(Modifier.fillMaxWidth().height((a.selectAllDividerWidth ?: 1.0).dp).background(awcColor(a.selectAllDividerColor ?: outlineVariant,Color.Gray)))
                        }
                    }
                    if(p.bool("loading")) { val pad=a.loadingPadding ?: insetLG
                        Box(Modifier.fillMaxWidth().inspectAWCNode(inspection,"loading-bar","loading-bar").padding(pad.dp)) {
                            Box(Modifier.fillMaxWidth().inspectAWCNode(inspection,"loading-progress","loading-progress")) { MultiNoIntrinsics(Modifier.fillMaxWidth()) {
                                AWCComponent("md-progress-indicator",mapOf("variant" to "linear","indeterminate" to true,"wave" to true,"label" to p.str("loadingText","Loading…"))) } } } }
                    else if(showNoOptions || showNoResults) MultiEmpty(if(showNoOptions) p.str("noOptionsText","No options") else p.str("noResultsText","No results"),a,tint,inspection)
                }
            }
        }
        }
    }
}

internal fun awcUniformCorners(r:Double):AWCCornerShape { val c=AWCCornerRadius(AWCCornerLength(r),AWCCornerLength(r));return AWCCornerShape(c,c,c,c) }
private val MultiRoboto=androidx.compose.ui.text.font.FontFamily(androidx.compose.ui.text.font.Font(R.font.awc_roboto_regular,FontWeight.Normal),
    androidx.compose.ui.text.font.Font(R.font.awc_roboto_medium,FontWeight.Medium))

/** A wrapping row (flex-wrap, `gap` between items and `rowGap` between rows, items centred in their row). */
@Composable internal fun AWCMultiChipsFlow(gap:Double,rowGap:Double,wrap:Boolean,modifier:Modifier=Modifier,content:@Composable ()->Unit)=Layout(content,modifier) { ms,c->
    val g=gap.dp.roundToPx();val rg=rowGap.dp.roundToPx();val maxW=if(c.hasBoundedWidth) c.maxWidth else Int.MAX_VALUE
    val ps=ms.map { it.measure(Constraints()) }
    val rows=mutableListOf(mutableListOf<Int>());var x=0
    ps.forEachIndexed { i,p-> if(wrap && x>0 && x+g+p.width>maxW) { rows+=mutableListOf<Int>();x=0 };x+=(if(x>0) g else 0)+p.width;rows.last()+=i }
    val rowW=rows.map { r-> r.sumOf { ps[it].width }+g*max(0,r.size-1) };val rowH=rows.map { r-> r.maxOfOrNull { ps[it].height } ?: 0 }
    // A stretched row (fillMaxWidth: min = max) keeps its full width; chips start at its start edge.
    val w=minOf(rowW.maxOrNull() ?: 0,maxW).coerceAtLeast(c.minWidth);val h=rowH.sum()+rg*max(0,rows.size-1)
    layout(w,h) { var y=0;val rtl=layoutDirection==LayoutDirection.Rtl
        rows.forEachIndexed { ri,r-> var xx=0;for(i in r) { val px=if(rtl) w-xx-ps[i].width else xx;ps[i].place(px,y+(rowH[ri]-ps[i].height)/2);xx+=ps[i].width+g };y+=rowH[ri]+rg } }
}

/** `.md-multi-select__clear`: a real button (28 × 28, round) before the caret; hover tints it with on-surface 8 %. */
@Composable private fun MultiClearButton(a:AWCMultiSelectAppearance,tint:String,tokens:Map<String,String>,icon:String,label:String,modifier:Modifier,onClick:()->Unit) {
    val src=remember { MutableInteractionSource() };val hovered by src.collectIsHoveredAsState();val focused by src.collectIsFocusedAsState()
    val size=a.clearSize ?: 28.0;val radius=a.clearRadius ?: size/2
    val hover=a.clearHoverBackground ?: ((tokens["--md-sys-color-on-surface"] ?: "#1D1B20").take(7)+"14")
    val bg=if(hovered) hover else a.clearBackground ?: "#00000000"
    val ringW=a.clearFocusRingWidth ?: 2.0;val ringOff=a.clearFocusRingOffset ?: 1.0;val ring=awcColor(a.clearFocusRingColor ?: tokens["--md-sys-color-primary"] ?: "#6750A4",Color.Blue)
    Box(modifier.size(size.dp).drawBehind {
            val r=radius.dp.toPx()
            drawRoundRect(awcColor(bg,Color.Transparent),cornerRadius=androidx.compose.ui.geometry.CornerRadius(r,r))
            if(focused) { val o=(ringOff+ringW/2).dp.toPx()
                drawRoundRect(ring,topLeft=Offset(-o,-o),size=androidx.compose.ui.geometry.Size(this.size.width+2*o,this.size.height+2*o),cornerRadius=androidx.compose.ui.geometry.CornerRadius(r+o,r+o),
                    style=androidx.compose.ui.graphics.drawscope.Stroke(ringW.dp.toPx())) } }
        .hoverable(src).focusable(interactionSource=src).clickable(src,null) { onClick() }.semantics { contentDescription=label;role=Role.Button },contentAlignment=Alignment.Center) {
        CompositionLocalProvider(androidx.compose.material3.LocalContentColor provides awcColor(a.clearColor ?: tint,Color.Black)) { AWCMaterialSymbol(icon,size=(a.clearIconSize ?: 18.0).dp) }
    }
}

/** `.md-multi-select__empty`: the centred no-options / no-results message (body-medium, on-surface-variant). */
@Composable private fun MultiEmpty(text:String,a:AWCMultiSelectAppearance,tint:String,inspection:AWCInspectionContext?) {
    val f=a.emptyFont ?: AWCMultiSelectFont(size=14.0,line=20.0);val pad=a.emptyPadding ?: listOf(12.0,16.0,12.0,16.0)
    val line=f.line ?: Math.round(f.size*1.171875).toDouble()
    BasicText(text,Modifier.fillMaxWidth().inspectAWCNode(inspection,"empty","empty").padding(top=pad[0].dp,end=pad[1].dp,bottom=pad[2].dp,start=pad[3].dp),
        style=TextStyle(fontFamily=MultiRoboto,fontWeight=FontWeight(f.weight),fontStyle=if(f.italic) FontStyle.Italic else FontStyle.Normal,fontSize=f.size.sp,lineHeight=line.sp,
            color=awcColor(a.emptyColor ?: tint,Color.Black),textAlign=TextAlign.Center,
            lineHeightStyle=androidx.compose.ui.text.style.LineHeightStyle(androidx.compose.ui.text.style.LineHeightStyle.Alignment.Center,androidx.compose.ui.text.style.LineHeightStyle.Trim.None)))
}

/** `.md-multi-select__search`: the filter input pinned in the menu header (padding 12 44 12 16, surface-container fill,
 *  1 px outline-variant bottom border; every value a hook). */
@Composable private fun MultiSearchField(rt:AWCMultiSelectRuntime,p:Props,a:AWCMultiSelectAppearance,tokens:Map<String,String>,inspection:AWCInspectionContext?) {
    val pad=a.searchPadding ?: listOf(12.0,44.0,12.0,16.0);val bw=a.searchBorderWidth ?: 1.0
    val border=awcColor(a.searchBorderColor ?: tokens["--md-sys-color-outline-variant"] ?: "#CAC4D0",Color.Gray)
    val style=TextStyle(fontFamily=MultiRoboto,fontSize=16.sp,lineHeight=19.sp,color=awcColor(a.searchColor ?: tokens["--md-sys-color-on-surface"] ?: "#1D1B20",Color.Black))
    val focus=remember { FocusRequester() }
    LaunchedEffect(rt.searchFocus) { if(rt.searchFocus>0) runCatching { focus.requestFocus() } }
    Box(Modifier.fillMaxWidth().inspectAWCNode(inspection,"search-wrap","search-wrap").inspectAWCNode(inspection,"search","search")
        .background(awcColor(a.searchBackground ?: tokens["--md-sys-color-surface-container"] ?: "#F3EDF7",Color.White))
        .drawBehind { drawRect(border,topLeft=Offset(0f,size.height-bw.dp.toPx()),size=androidx.compose.ui.geometry.Size(size.width,bw.dp.toPx())) }
        .padding(start=pad[3].dp,end=pad[1].dp,top=pad[0].dp,bottom=(pad[2]+bw).dp)) {
        if(rt.query.isEmpty()) BasicText(p.str("searchPlaceholder","Search…"),Modifier.clearAndSetSemantics { },style=style.copy(color=awcColor(a.searchPlaceholderColor ?: tokens["--md-sys-color-on-surface-variant"] ?: "#49454F",Color.Gray)),maxLines=1)
        BasicTextField(rt.query,{ rt.query=it },Modifier.fillMaxWidth().height(19.dp).focusRequester(focus).semantics { contentDescription=p.str("filterLabel").ifEmpty { if(p.str("label").isEmpty()) "Filter options" else "Filter ${p.str("label")}" };stateDescription="expanded";collapse { rt.close();true } },
            textStyle=style,singleLine=true,cursorBrush=SolidColor(style.color))
    }
}

/**
 * The menu sizes itself from its header's intrinsic width (max-content); md-progress-indicator is built on a
 * SubcomposeLayout, which cannot answer intrinsics. The loading bar fills the menu (Chrome: block, width 100%), so it
 * reports no intrinsic width and its last measured height.
 */
@Composable private fun MultiNoIntrinsics(modifier:Modifier=Modifier,content:@Composable ()->Unit) {
    val last=remember { intArrayOf(0) }
    Layout(content,modifier,object:MeasurePolicy {
        override fun MeasureScope.measure(measurables:List<Measurable>,constraints:androidx.compose.ui.unit.Constraints):MeasureResult {
            val ps=measurables.map { it.measure(constraints) }
            val w=(ps.maxOfOrNull { it.width } ?: 0).coerceIn(constraints.minWidth,constraints.maxWidth)
            val h=(ps.maxOfOrNull { it.height } ?: 0).coerceIn(constraints.minHeight,constraints.maxHeight)
            last[0]=h
            return layout(w,h) { ps.forEach { it.place(0,0) } }
        }
        override fun IntrinsicMeasureScope.minIntrinsicWidth(measurables:List<IntrinsicMeasurable>,height:Int)=0
        override fun IntrinsicMeasureScope.maxIntrinsicWidth(measurables:List<IntrinsicMeasurable>,height:Int)=0
        override fun IntrinsicMeasureScope.minIntrinsicHeight(measurables:List<IntrinsicMeasurable>,width:Int)=last[0]
        override fun IntrinsicMeasureScope.maxIntrinsicHeight(measurables:List<IntrinsicMeasurable>,width:Int)=last[0]
    })
}
