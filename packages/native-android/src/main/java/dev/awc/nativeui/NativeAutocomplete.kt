package dev.awc.nativeui

import android.animation.ValueAnimator
import android.view.accessibility.AccessibilityEvent
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.layout
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.type
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.PointerInputChange
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.*
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.max
import kotlin.math.roundToInt

// md-autocomplete: an editable md-text-field (combobox) with an md-menu listbox of option rows that never takes focus while
// the user types, composed from the library's own renderers as the source composes its primitives (md-text-field, md-menu,
// md-menu-item, md-chip, md-icon-button). The option model, caret, chip flow and slot fallback are md-select's /
// md-multi-select's (NativeSelect.kt, NativeMultiSelect.kt).

/** The eleven md-autocomplete hooks (`--md-autocomplete-*`); lengths in dp (= CSS px), colours `#RRGGBB[AA]`. */
data class AWCAutocompleteAppearance(val width:Double?=null,val minWidth:Double?=null,val chipGap:Double?=null,val chipRadius:Double?=null,
                                     val caretColor:String?=null,val caretSize:Double?=null,val clearColor:String?=null,val optionIconColor:String?=null,
                                     val optionIconSize:Double?=null,val loadingColor:String?=null,val spinnerSize:Double?=null) {
    fun merge(o:AWCAutocompleteAppearance)=AWCAutocompleteAppearance(o.width ?: width,o.minWidth ?: minWidth,o.chipGap ?: chipGap,o.chipRadius ?: chipRadius,
        o.caretColor ?: caretColor,o.caretSize ?: caretSize,o.clearColor ?: clearColor,o.optionIconColor ?: optionIconColor,o.optionIconSize ?: optionIconSize,
        o.loadingColor ?: loadingColor,o.spinnerSize ?: spinnerSize)
    companion object {
        private val hex=Regex("^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$")
        /** CSS custom properties as authored on the host (`--md-autocomplete-caret-size: 30px`). */
        fun fromCss(css:Map<String,String>):AWCAutocompleteAppearance {
            fun raw(k:String)=css["--md-autocomplete-$k"]?.trim()?.takeIf { it.isNotEmpty() }
            fun px(k:String)=raw(k)?.replace("px","")?.trim()?.toDoubleOrNull()?.takeIf { it>=0 }
            fun c(k:String)=raw(k)?.takeIf { hex.matches(it) }
            return AWCAutocompleteAppearance(px("width"),px("min-width"),px("chip-gap"),px("chip-radius"),c("caret-color"),px("caret-size"),c("clear-color"),
                c("option-icon-color"),px("option-icon-size"),c("loading-color"),px("spinner-size"))
        }
        /** Typed values (Laboratory): `width`, `minWidth`, `chipGap` … */
        fun fromValues(v:Map<String,AWCValue>):AWCAutocompleteAppearance {
            fun n(k:String)=(v[k] as? Number)?.toDouble()?.takeIf { it>=0 }
            fun c(k:String)=(v[k] as? String)?.takeIf { hex.matches(it) }
            return AWCAutocompleteAppearance(n("width"),n("minWidth"),n("chipGap"),n("chipRadius"),c("caretColor"),n("caretSize"),c("clearColor"),c("optionIconColor"),
                n("optionIconSize"),c("loadingColor"),n("spinnerSize"))
        }
    }
}
internal val LocalAWCAutocompleteAppearance=compositionLocalOf { AWCAutocompleteAppearance() }
@Composable fun AWCAutocompleteAppearanceScope(appearance:AWCAutocompleteAppearance,content:@Composable ()->Unit) {
    val inherited=LocalAWCAutocompleteAppearance.current
    CompositionLocalProvider(LocalAWCAutocompleteAppearance provides inherited.merge(appearance),content=content)
}

/** One suggestion, as the `filterer` sees it (`SelectOptionData`). */
data class AWCAutocompleteOption(val value:String,val label:String=value,val disabled:Boolean=false,val supportingText:String="",val icon:String="",val iconColor:String="")
internal fun AWCSelectOptionData.toAutocomplete()=AWCAutocompleteOption(value,label,disabled,supportingText,icon,iconColor)
internal fun AWCAutocompleteOption.toData()=AWCSelectOptionData(value,label,disabled,icon,iconColor,supportingText)
/** `normalize`: label defaults to the value; `description` is a legacy alias of `supportingText`. */
internal fun awcAutocompleteOption(v:Any?):AWCSelectOptionData? { val o=AWCSelectOptions.init(v) ?: return null
    val d=((v as? Map<*,*>)?.get("description") as? String).orEmpty();return if(o.supportingText.isEmpty() && d.isNotEmpty()) o.copy(supportingText=d) else o }
internal fun awcAutocompleteOptions(v:AWCValue):List<AWCSelectOptionData> = when(v) {
    is String->runCatching { awcList(org.json.JSONArray(v)) }.getOrDefault(emptyList()).mapNotNull(::awcAutocompleteOption)
    else->awcList(v).mapNotNull(::awcAutocompleteOption) }
/** `defaultFilter`: case-insensitive substring of the label, the value or the supporting text. */
internal fun awcAutocompleteFilter(options:List<AWCSelectOptionData>,query:String):List<AWCSelectOptionData> { val q=query.lowercase()
    return if(q.isEmpty()) options else options.filter { it.label.lowercase().contains(q) || it.value.lowercase().contains(q) || it.supportingText.lowercase().contains(q) } }
/** `selectedArray`: the list value (multiple) or the non-empty string value. */
internal fun awcAutocompleteValue(v:AWCValue,multiple:Boolean):List<String> = when {
    multiple && v is String->if(v.isEmpty()) emptyList() else runCatching { awcList(org.json.JSONArray(v)).map { it.toString() } }.getOrDefault(emptyList())
    multiple->awcList(v).map { it.toString() }
    v is String && v.isNotEmpty()->listOf(v)
    v is List<*>->emptyList()
    else->emptyList() }

/** md-autocomplete methods: `focusInput`, `showMenu`, `closeMenu`, `loadOptions`, `getLabels`, the validity API and `filterer`. */
class AWCAutocompleteController {
    internal var runtime:AWCAutocompleteRuntime?=null
    val isConnected get()=runtime!=null
    fun focusInput() { runtime?.field?.setFocus() }
    fun showMenu() { runtime?.show?.invoke() }
    fun closeMenu() { runtime?.close?.invoke() }
    /** Replaces the options (`loadOptions(array)`); native lists are not virtualized. */
    fun loadOptions(options:List<AWCValue>) { runtime?.loaded=options.mapNotNull(::awcAutocompleteOption) }
    /** `getLabels(values)`: the label of each value (the value itself when it has none). */
    fun getLabels(values:List<String>):Map<String,String> { val r=runtime;return values.associateWith { v-> r?.label(v) ?: v } }
    fun getValidity():AWCConstraintValidity=runtime?.validityNow ?: AWCConstraintValidity.VALID
    fun checkValidity():Boolean=runtime?.validityNow?.valid ?: true
    fun reportValidity():Boolean { val r=runtime ?: return true;if(r.validityNow.valid) return true;r.revealed=true;r.field.setFocus();return false }
    fun setCustomValidity(message:String) { runtime?.customMessage=message }
    /** The `filterer` property: (options, inputValue, selected) -> options (the client-side filter; `limitResults` still applies). */
    var filterer:((List<AWCAutocompleteOption>,String,List<String>)->List<AWCAutocompleteOption>)? by mutableStateOf(null)
    /** Tests: types [text] into the input as the user would. */
    internal fun typeText(text:String) { runtime?.typeText?.invoke(text) }
}
internal val LocalAWCAutocompleteController=staticCompositionLocalOf<AWCAutocompleteController?> { null }
@Composable fun AWCAutocompleteControllerScope(controller:AWCAutocompleteController,content:@Composable ()->Unit)=
    CompositionLocalProvider(LocalAWCAutocompleteController provides controller,content=content)

internal class AWCAutocompleteRuntime {
    val field=AWCTextFieldController()
    var loaded by mutableStateOf<List<AWCSelectOptionData>?>(null)
    var customMessage by mutableStateOf("")
    var revealed by mutableStateOf(false)
    var focused by mutableStateOf(false)
    var clearFocused by mutableStateOf(false)
    /** A value was committed (the source reports '' for an unset value, even when multiple). */
    var committed=false
    /** Only what was typed since the popup opened filters the list (`typedSinceOpen`). */
    var typedSinceOpen by mutableStateOf(false)
    var listFocusToken by mutableIntStateOf(0)
    var pendingListFocus:String?=null
    var lastEmit:String?=null
    var lastValidityKey:String?=null
    var openedByKey=false
    var menuSynced=false
    var lastStatus=""
    /** Labels of committed values that are not (or no longer) options: picks and free-solo values (`labelMap`). */
    val labelCache=mutableMapOf<String,String>()
    var validityNow=AWCConstraintValidity.VALID
    var optionsNow:List<AWCSelectOptionData> = emptyList()
    var show:()->Unit={};var close:()->Unit={};var typeText:(String)->Unit={}
    fun label(v:String)=optionsNow.firstOrNull { it.value==v }?.label ?: labelCache[v] ?: v
}

/** md-autocomplete (see the file comment). The menu presents in the nearest [AWCMenuScope]. */
@Composable internal fun NativeAutocomplete(p:Props,onEvent:EventSink,controlEvent:EventSink,slot:Slot?,formField:AWCFormField?,form:AWCFormState?) {
    val generated=remember { "autocomplete-"+java.util.UUID.randomUUID().toString().take(8) }
    val id=p.str("id").ifEmpty { generated }
    val multiple=p.bool("multiple")
    var value by awcState(listOf(p["value"],multiple)) { awcAutocompleteValue(p["value"],multiple) }
    var inputValue by awcState(p["inputValue"]) { (p["inputValue"] as? String).orEmpty() }
    var open by awcState(p["open"]) { p.bool("open") }
    val rt=remember { AWCAutocompleteRuntime() }
    // The latest row-key handler: the menu controller keeps a lambda that reads it.
    val rowKeyRef=remember { arrayOf<(String)->Boolean>({ false }) }
    val controller=LocalAWCAutocompleteController.current
    val registry=LocalNativeMenuRegistry.current
    val tokens=LocalAWCThemeTokens.current
    val a=LocalAWCAutocompleteAppearance.current
    val inspection=LocalAWCInspection.current
    val selectInspection=LocalAWCSelectInspection.current
    val reduced=LocalAWCFieldReducedMotion.current ?: !ValueAnimator.areAnimatorsEnabled()
    val view=androidx.compose.ui.platform.LocalView.current
    val disabled=p.bool("disabled");val inert=disabled || p.bool("softDisabled")
    val freeSolo=p.bool("freeSolo");val busy=p.bool("loading")
    val emit:(String,Any?)->Unit={ n,d-> selectInspection?.events?.add(Triple(n,id,d));controlEvent(n,d) }
    val collector=remember { AWCSelectOptionCollector() }
    Box(Modifier.size(0.dp)) { CompositionLocalProvider(LocalAWCSelectOptions provides collector) { slot?.invoke("") } }
    // Visible carriers win; with none (every carrier hidden counts as none) the `options` property is read.
    val visibleCarriers=collector.options.filter { !it.hidden }
    val authored=if(visibleCarriers.isNotEmpty()) visibleCarriers else awcAutocompleteOptions(p["options"])
    // `@Watch('options')` / slotchange (`refreshOptions`): the authored list replaces options loaded with loadOptions().
    // Keyed on the raw property (a new list or its JSON text is a new value, as for the source's watcher) and the carriers.
    val authoredKey=listOf(p["options"],visibleCarriers)
    val lastAuthored=remember { arrayOfNulls<Any>(1) }
    if(lastAuthored[0]!=null && lastAuthored[0]!=authoredKey && rt.loaded!=null) rt.loaded=null
    lastAuthored[0]=authoredKey
    val options=rt.loaded ?: authored
    rt.optionsNow=options
    val chipPosition=p.str("chipPosition").takeIf { it in listOf("below","top","left","right","inline") } ?: "below"
    val inline=multiple && chipPosition=="inline"
    val accessibleName=p.str("label").ifEmpty { p.str("aria-label").ifEmpty { p.str("ariaLabel") } }.trim()
    val validity=when { rt.customMessage.isNotEmpty()->AWCConstraintValidity.of("customError",rt.customMessage)
        p.bool("required") && value.isEmpty()->AWCConstraintValidity.of("valueMissing",p.str("errorText").ifEmpty { p.str("valueMissingLabel","Please make a selection") }); else->AWCConstraintValidity.VALID }
    val validationMessage=if(rt.revealed && !validity.valid) validity.validationMessage else ""
    val density=(p["density"] as? Number)?.toDouble()
    val rung=density?.takeIf { it in listOf(-1.0,-2.0,-3.0,-4.0) } ?: LocalAWCNativeDensity.current
    val insetLG=if(rung<=-4) 8.0 else if(rung<=-2) 12.0 else 16.0
    val insetMD=if(rung<=-2) 8.0 else 12.0
    val insetSM=if(rung<=-3) 4.0 else 8.0
    val gapSM=if(rung<=-3) 4.0 else 8.0
    val chipGap=a.chipGap ?: if(rung<=-4) 2.0 else 4.0
    val tint=tokens["--md-sys-color-on-surface-variant"] ?: "#49454F"
    val anchorID="$id::trigger";val menuID="$id::menu"
    rt.validityNow=validity
    fun label(v:String)=options.firstOrNull { it.value==v }?.label ?: rt.labelCache[v] ?: v
    val query=if(rt.typedSinceOpen) inputValue.trim() else ""
    val filtered=run {
        val f=controller?.filterer
        var results=if(f!=null) f(options.map { it.toAutocomplete() },query,value).map { it.toData() } else awcAutocompleteFilter(options,query)
        val limit=(p["limitResults"] as? Number)?.toInt() ?: 0
        if(limit>0) results=results.take(limit)
        results
    }
    // Row ids follow the option's position in the full list (md-menu keeps per-row state by id; a filtered index would hand one
    // option's checked / focus state to another when the query changes).
    val rowIds=run { val used=HashSet<Int>(); filtered.mapIndexed { k,o-> val i=options.indices.firstOrNull { it !in used && options[it]==o } ?: (options.size+k); used.add(i); "$id::opt$i" } }
    val status=if(busy) p.str("loadingText","Loading…") else if(open) p.str("statusTemplate","{count} suggestions available").replace("{count}",filtered.size.toString()) else ""
    LaunchedEffect(validity.key) { val k=validity.key;val last=rt.lastValidityKey;rt.lastValidityKey=k;if(last!=null && last!=k) emit("mdValidityChange",validity.eventValue) }
    // A programmatic single value while closed shows its label in the input, silently (`syncFormValue`).
    LaunchedEffect(value,options) { if(!multiple && !open && p["value"]!=null) { val committed=value.firstOrNull()?.let { label(it) }.orEmpty();if(inputValue!=committed) inputValue=committed } }
    // Polite status ("{count} suggestions available"), announced when it changes.
    LaunchedEffect(status) { if(status.isNotEmpty() && status!=rt.lastStatus) view.announceForAccessibility(status);rt.lastStatus=status }
    val focusedNow=rt.focused
    val clearFocusedNow=rt.clearFocused
    SideEffect {
        controller?.runtime=rt
        rt.show={ if(!inert) open=true };rt.close={ open=false }
        selectInspection?.states?.set(id,mapOf("open" to open,"value" to (if(multiple) (if(value.isEmpty() && !rt.committed) "" else value) else value.firstOrNull().orEmpty()),
            "inputValue" to inputValue,"focused" to focusedNow,"clearFocused" to clearFocusedNow,"status" to status,"rows" to filtered.map { it.label },"rowIds" to rowIds,"valid" to validity.valid))
    }
    fun syncMenu(c:NativeMenuController,o:Boolean,keyboard:Boolean) {
        // Printable keys and Backspace on a row return to the input (`handleListboxKeyDown`).
        c.rowKeyClaim={ k-> rowKeyRef[0](k) }
        if(o) { if(!c.isOpen || c.closing) c.show(false,keyboard) } else if(c.isOpen && !c.closing) c.close()
    }
    LaunchedEffect(open,registry) {
        if(!open) rt.pendingListFocus=null
        val r=registry ?: return@LaunchedEffect
        if(!rt.menuSynced) { withFrameNanos { };rt.menuSynced=true }
        var c=r.controllers[menuID];var tries=0
        while(c==null && tries<20) { withFrameNanos { };c=r.controllers[menuID];tries++ }
        c ?: return@LaunchedEffect
        syncMenu(c,open,rt.openedByKey)
        rt.openedByKey=false
    }
    fun syncMenuNow(o:Boolean,keyboard:Boolean) { val c=registry?.controllers?.get(menuID) ?: return;rt.menuSynced=true;syncMenu(c,o,keyboard) }
    fun commit(next:List<String>) { rt.committed=true;value=next;emit("mdChange",if(multiple) next else next.firstOrNull().orEmpty()) }
    /** `applyTyped`: the text, the typing gate, one mdInput, and the popup opens. */
    fun typed(text:String) { rt.pendingListFocus=null;inputValue=text;rt.typedSinceOpen=true;emit("mdInput",text);if(!open && !inert) { open=true;syncMenuNow(true,false) } }
    fun pick(o:AWCSelectOptionData) {
        if(o.disabled || inert) return
        rt.labelCache[o.value]=o.label
        if(multiple) { val exists=o.value in value;val maxSel=(p["maxSelected"] as? Number)?.toInt() ?: 0
            if(!exists && maxSel>0 && value.size>=maxSel) return
            commit(if(exists) value-o.value else value+o.value);inputValue="";emit("mdInput","");rt.typedSinceOpen=false;rt.field.setFocus() }
        else { commit(listOf(o.value));inputValue=o.label;emit("mdInput",o.label);rt.typedSinceOpen=false
            if(!p.bool("disableCloseOnSelect")) { open=false;syncMenuNow(false,false) };rt.field.setFocus() }
    }
    fun commitFreeSolo():Boolean {
        if(!freeSolo) return false
        val raw=inputValue.trim();if(raw.isEmpty()) return false
        if(multiple) { if(raw in value) return true;val maxSel=(p["maxSelected"] as? Number)?.toInt() ?: 0;if(maxSel>0 && value.size>=maxSel) return false
            rt.labelCache[raw]=raw;commit(value+raw);inputValue="";emit("mdInput","") }
        else commit(listOf(raw))
        return true
    }
    fun removeChip(v:String) { if(inert || !multiple) return;commit(value-v) }
    fun clearAll() { if(inert) return;inputValue="";emit("mdInput","");rt.typedSinceOpen=false;commit(emptyList());emit("mdClear",null);rt.field.setFocus() }
    rt.typeText={ typed(it) }
    // The menu's close (the source's handleMenuClose): the typing gate resets; strict single mode snaps the text back.
    fun menuClosed() {
        if(open) open=false;rt.pendingListFocus=null
        if(rt.lastEmit!="close") { rt.lastEmit="close";emit("mdClose",null) }
        rt.typedSinceOpen=false
        if(!multiple && !freeSolo) { val committed=value.firstOrNull()?.let { label(it) }.orEmpty();if(inputValue!=committed) { inputValue=committed;emit("mdInput",committed) } }
    }
    LaunchedEffect(rt.listFocusToken) {
        if(rt.listFocusToken==0) return@LaunchedEffect
        repeat(40) {
            withFrameNanos { }
            val which=rt.pendingListFocus ?: return@LaunchedEffect
            if(!open) return@LaunchedEffect
            val c=registry?.controllers?.get(menuID)
            if(c!=null && c.isOpen && !c.closing) {
                val enabled=c.rowOrder.filter { c.rows[it]?.disabled==false }
                val target=if(which=="first") enabled.firstOrNull() else enabled.lastOrNull()
                if(target!=null && c.focus(target,true)) { rt.pendingListFocus=null;return@LaunchedEffect }
            }
        }
    }
    /** md-autocomplete `handleFieldKeyDown`. */
    fun fieldKey(k:String):Boolean {
        if(inert) return false
        return when(k) {
            "ArrowDown","ArrowUp"->{ rt.pendingListFocus=if(k=="ArrowDown") "first" else "last"
                if(!open) { rt.openedByKey=true;open=true;syncMenuNow(true,true) };rt.listFocusToken++;true }
            "Enter"->if(commitFreeSolo()) { if(!multiple) { open=false;syncMenuNow(false,true) };true } else false
            "Escape"->if(open) { open=false;syncMenuNow(false,true);true } else false
            "Backspace"->{ if(multiple && inputValue.isEmpty() && value.isNotEmpty()) commit(value.dropLast(1));false }
            else->false
        }
    }
    rowKeyRef[0]={ k-> if(inert) false else { val back=k=="Backspace"
        if(!back && (k.length!=1 || k==" ")) false else { rt.field.setFocus();typed(if(back) inputValue.dropLast(1) else inputValue+k);true } } }
    fun focusChanged(f:Boolean) {
        rt.focused=f
        if(f || open || !p.bool("clearOnBlur") || multiple || freeSolo) return
        val committed=value.firstOrNull()?.let { label(it) }.orEmpty()
        if(inputValue.isNotEmpty() && inputValue!=committed) { inputValue=committed;emit("mdInput",committed) }
    }
    val clearShown=p.bool("clearable",true) && !busy && (if(multiple) value.isNotEmpty() else inputValue.isNotEmpty() || value.isNotEmpty())
    val trailingBounds=remember { arrayOfNulls<Rect>(1) }
    val inlineBounds=remember { arrayOfNulls<Rect>(1) }
    val fieldOrigin=remember { arrayOf(Offset.Zero) }
    val caretTurn=remember { Animatable(if(open) 1f else 0f) }
    LaunchedEffect(open,reduced) { val t=if(open) 1f else 0f;if(reduced) caretTurn.snapTo(t) else caretTurn.animateTo(t,tween(200,easing=CubicBezierEasing(.2f,0f,0f,1f))) }
    val chipAppearance=AWCChipHookAppearance(containerShape=awcUniformCorners(a.chipRadius ?: 8.0))
    @Composable fun Chip(v:String,k:Int) {
        AWCComponent("md-chip",mapOf("id" to "$id::chip$k","variant" to "input","selectable" to false,"label" to label(v),"disabled" to inert,"removable" to !inert),
            onEvent={ n,_-> if(n=="mdRemove") removeChip(v) },modifier=Modifier.inspectAWCNode(inspection,"chip-$k","chip"))
    }
    val chipsGroup=if(p.str("label").isEmpty()) "Selected" else "${p.str("label")} — selected"
    val chips:@Composable (Modifier)->Unit={ m->
        AWCChipAppearanceScope(chipAppearance) {
            AWCMultiChipsFlow(chipGap,chipGap,true,m.inspectAWCNode(inspection,"chips","chips").semantics { contentDescription=chipsGroup }) {
                value.forEachIndexed { k,v-> key(v) { Chip(v,k) } } }
        }
    }
    val trailing:@Composable ()->Unit={
        val turn=caretTurn.value
        SideEffect { selectInspection?.states?.set("$id::caret",mapOf("rotation" to turn.toDouble())) }
        Row(Modifier.onGloballyPositioned { trailingBounds[0]=it.boundsInRoot() }.inspectAWCNode(inspection,"trailing","trailing"),verticalAlignment=Alignment.CenterVertically) {
            if(p.bool("clearable",true)) Box(Modifier.size(28.dp).inspectAWCNode(inspection,"clear","clear").onFocusChanged { rt.clearFocused=it.hasFocus }) {
                // `visibility: hidden` while there is nothing to clear: the box keeps the trailing cluster's width.
                if(clearShown) { val color=a.clearColor ?: tint
                    AWCIconButtonAppearanceScope(AWCIconButtonAppearance(iconColor=color,stateLayerColor=color,iconSize=18.0,width=28.0,height=28.0)) {
                        AWCComponent("md-icon-button",mapOf("variant" to "standard","size" to "xs","icon" to p.str("clearIcon","close"),"aria-label" to "Clear value","toggle" to false,
                            // Chrome: inside the disabled field the clear button is a disabled Tab stop (aria-disabled).
                            "softDisabled" to disabled),
                            onEvent={ n,_-> if(n=="mdClick") clearAll() }) } }
            }
            if(p.bool("clearable",true)) Spacer(Modifier.width(2.dp))
            if(busy) Box(Modifier.size(24.dp).inspectAWCNode(inspection,"loading-spinner","loading-spinner"),contentAlignment=Alignment.Center) {
                val size=a.spinnerSize ?: 22.0
                AWCLoadingIndicatorAppearanceScope(AWCLoadingIndicatorAppearance(size=size,shapeSize=size)) {
                    SelectSlotOr(slot,"loader") { AWCComponent("md-loading-indicator",mapOf("label" to p.str("loadingText","Loading…"))) } }
            } else Box(Modifier.size(24.dp).inspectAWCNode(inspection,"caret","caret").clearAndSetSemantics { }
                .clickable(interactionSource=remember { MutableInteractionSource() },indication=null) { if(!inert) { open=!open;syncMenuNow(open,false) } }
                .rotate(180f*turn),contentAlignment=Alignment.Center) {
                val size=a.caretSize ?: 24.0
                CompositionLocalProvider(androidx.compose.material3.LocalContentColor provides awcColor(a.caretColor ?: tint,Color.Black)) {
                    SelectSlotOr(slot,"dropdown-icon") { AWCMaterialSymbol(p.str("dropdownIcon","arrow_drop_down"),size=size.dp) } }
            }
        }
    }
    val inlineChips:@Composable ()->Unit={
        AWCChipAppearanceScope(chipAppearance) {
            AWCMultiChipsFlow(chipGap,chipGap,true,Modifier.onGloballyPositioned { inlineBounds[0]=it.boundsInRoot() }.inspectAWCNode(inspection,"chips","chips")
                .semantics { contentDescription=chipsGroup }) { value.forEachIndexed { k,v-> key(v) { Chip(v,k) } } }
        }
    }
    val trigger:@Composable ()->Unit={
        val hooks=AWCFieldHooks(key={ k-> fieldKey(k) },focus={ f-> focusChanged(f) },trailing=trailing,controller=rt.field,editingKeys=true,
            // role="combobox" aria-expanded: TalkBack's expand / collapse actions open and close the suggestions.
            expand={ e-> if(e) rt.show() else rt.close() },
            // The inner field's mdChange / mdSearch stay inside (source D2); its mdInput is the user's edit (`applyTyped`).
            event={ n,d-> if(n=="mdInput") typed(d as? String ?: d?.toString().orEmpty()) })
        val fieldProps:Props=buildMap {
            put("variant",p.str("variant","filled"));put("label",p.str("label"));if(p.str("label").isEmpty() && accessibleName.isNotEmpty()) put("aria-label",accessibleName)
            put("placeholder",p.str("placeholder"));put("disabled",disabled);put("required",p.bool("required"))
            put("error",p.bool("error") || validationMessage.isNotEmpty());put("errorText",p.str("errorText").ifEmpty { validationMessage })
            put("reserveSupportingSpace",p.bool("reserveSupportingSpace"));put("supportingText",p.str("supportingText"));if(density!=null) put("density",density)
            put("appearFocused",open || focusedNow);put("value",inputValue);put("aria-haspopup","listbox")
            put("inputRole","combobox");put("inputExpanded",open);put("inputAriaAutocomplete","list");put("chipsWrap",inline)
        }
        // :host sets --md-text-field-padding-inline-end: inset-lg.
        AWCTextFieldAppearanceScope(AWCTextFieldAppearance(paddingInlineEnd=insetLG)) {
            Box(Modifier.fillMaxWidth().awcMenuAnchor(anchorID,null).inspectAWCNode(inspection,"field","field").onGloballyPositioned { fieldOrigin[0]=it.boundsInRoot().topLeft }
                // A key typed in the input stamps the menu layer's input time, so the popup it opens starts its entrance from the key
                // (Chrome restyles in the frame after the input event), as the select family's key-opened menus do.
                .onPreviewKeyEvent { e-> if(e.type==KeyEventType.KeyDown) registry?.inputTime=e.nativeKeyEvent.eventTime.toDouble();false }
                // The source's onClick on its field opens the popup; a click while open is outside the menu and closes it. Observed in
                // the Initial pass without consuming: the editable input keeps its own caret placement. The trailing buttons and the
                // chips stop their clicks.
                .pointerInput(inert) { awaitEachGesture {
                    val down=awaitFirstDown(false,PointerEventPass.Initial)
                    var up:PointerInputChange?=null
                    while(true) { val e=awaitPointerEvent(PointerEventPass.Initial);val c=e.changes.firstOrNull { it.id==down.id } ?: break;if(!c.pressed) { up=c;break } }
                    val u=up ?: return@awaitEachGesture
                    val inside=u.position.x>=0 && u.position.y>=0 && u.position.x<size.width && u.position.y<size.height
                    val at=fieldOrigin[0]+down.position
                    val excluded=trailingBounds[0]?.contains(at)==true || (inline && inlineBounds[0]?.contains(at)==true)
                    if(inside && !inert && !excluded) { open=!open;syncMenuNow(open,false) } } }) {
                CompositionLocalProvider(LocalAWCInspection provides inspection?.copy(id=anchorID,entered=true,parentId=inspection.id)) {
                    NativeTextField(fieldProps,{ _,_-> },{ _,_-> },{ name-> if(name=="chips" && inline && value.isNotEmpty()) inlineChips() },null,null,hooks) }
            }
        }
    }
    val showChips=multiple && !inline && value.isNotEmpty()
    val minW=a.minWidth ?: 220.0
    val host=Modifier.let { if(a.width!=null) it.width(maxOf(a.width,minW).dp) else it.fillMaxWidth() }.widthIn(min=minW.dp)
    Column(host) {
        when(if(multiple) chipPosition else "below") {
            "top"->Column { if(showChips) chips(Modifier.fillMaxWidth().padding(bottom=insetSM.dp));trigger() }
            "left","right"->if(showChips) AutocompleteSideRow(chipPosition=="left",gapSM,{ chips(Modifier) },trigger) else trigger()
            else->Column { trigger();if(showChips) chips(Modifier.fillMaxWidth().padding(top=insetSM.dp)) }
        }
        val emptyText=if(busy) "" else if(options.isEmpty()) p.str("noOptionsText","No options") else if(filtered.isEmpty()) p.str("noResultsText","No results") else ""
        CompositionLocalProvider(LocalNativeMenuCollector provides inspection?.collector) {
        AWCComponent("md-menu",buildMap { put("id",menuID);put("anchor",anchorID);put("placement",p.str("placement","bottom-start"));put("matchAnchorWidth",p.bool("matchTriggerWidth",true))
                put("persistent",p.bool("disableCloseOnSelect"));put("emptyText",emptyText);put("autoFocus",false);put("listbox",true);put("listLabel",p.str("label").ifEmpty { "Options" })
                p["maxHeight"]?.let { put("maxHeight",it) };if(density!=null) put("density",density) },
            onEvent={ n,_-> when(n) { "mdOpen"->{ if(!open) open=true;if(rt.lastEmit!="open") { rt.lastEmit="open";emit("mdOpen",null) };if(rt.pendingListFocus!=null) rt.listFocusToken++ }
                "mdClose"->menuClosed() } }) { s->
            when(s) {
                // Positional rows (no key): md-menu orders its rows by first composition, so a kept row of a re-filtered list
                // would otherwise sort before the rows added around it.
                ""-> if(!busy) filtered.forEachIndexed { k,o-> val rid=rowIds[k]; run {
                    AWCComponent("md-menu-item",mapOf("id" to rid,"presentation" to "option","type" to (if(multiple) "checkbox" else "radio"),"checkPosition" to "start","keepOpen" to true,
                        "disabled" to o.disabled,"selected" to (o.value in value),"headline" to o.label,"supportingText" to o.supportingText),
                        onEvent={ n,_-> if(n=="mdClick") pick(o) }) { rs->
                        if(rs=="leading-icon" && o.icon.isNotEmpty()) CompositionLocalProvider(androidx.compose.material3.LocalContentColor provides
                            awcColor(o.iconColor.ifEmpty { a.optionIconColor ?: tint },Color.Black)) {
                            val optCtx=remember(inspection?.collector,rid) { inspection?.collector?.let { AWCInspectionContext(it,rid,true,rid) } }
                            AWCMaterialSymbol(o.icon,modifier=Modifier.inspectAWCNode(optCtx,"option-icon","option-icon"),size=(a.optionIconSize ?: 20.0).dp) }
                    } } }
                "header"-> if(busy) Box(Modifier.fillMaxWidth().inspectAWCNode(inspection,"loading","loading").padding(horizontal=insetLG.dp,vertical=insetMD.dp)
                        .semantics(mergeDescendants=true) { contentDescription=p.str("loadingText","Loading…") }) {
                    Box(Modifier.fillMaxWidth().inspectAWCNode(inspection,"loading-progress","loading-progress")) {
                        CompositionLocalProvider(androidx.compose.material3.LocalContentColor provides awcColor(a.loadingColor ?: tint,Color.Black)) {
                            AWCComponent("md-progress-indicator",mapOf("variant" to "linear","indeterminate" to true,"wave" to true,"label" to p.str("loadingText","Loading…"))) } } }
            }
        }
        }
        // The polite status region (`.md-autocomplete__sr-status`, absolutely positioned): a 1 px live region read after each
        // filter change that takes no space in the column.
        // Empty (closed, idle) it has nothing to read: no accessibility node then (ATF SpeakableTextPresentCheck on an empty
        // live region); the status is also announced with announceForAccessibility when it changes.
        // As on Web the region itself is unnamed and its text is the message (a transparent 1 px text, no layout space).
        if(status.isNotEmpty()) Box(Modifier.layout { m,_-> val pl=m.measure(androidx.compose.ui.unit.Constraints.fixed(1,1));layout(0,0) { pl.place(0,0) } }
            .semantics { liveRegion=LiveRegionMode.Polite }) {
            androidx.compose.material3.Text(status,Modifier.fillMaxSize(),color=androidx.compose.ui.graphics.Color.Transparent,fontSize=1.sp,maxLines=1,softWrap=false)
        }
    }
}
/** `chip-position` left / right: a centred row; the chips are `flex: 0 1 auto` capped at half the width, the field takes the rest. */
@Composable private fun AutocompleteSideRow(chipsFirst:Boolean,gap:Double,chips:@Composable ()->Unit,field:@Composable ()->Unit) {
    val rtl=LocalLayoutDirection.current==LayoutDirection.Rtl
    Layout({ Box { chips() };Box { field() } },Modifier.fillMaxWidth()) { ms,c->
        val w=if(c.hasBoundedWidth) c.maxWidth else 320.dp.roundToPx()
        val g=gap.dp.roundToPx()
        val chipsW=minOf(ms[0].maxIntrinsicWidth(Constraints.Infinity),w/2)
        val cp=ms[0].measure(Constraints(maxWidth=chipsW));val fp=ms[1].measure(Constraints(minWidth=max(0,w-g-cp.width),maxWidth=max(0,w-g-cp.width)))
        val h=max(cp.height,fp.height)
        layout(w,h) {
            val first=if(chipsFirst) cp else fp;val second=if(chipsFirst) fp else cp
            val x1=0;val x2=first.width+g
            first.place(if(rtl) w-x1-first.width else x1,(h-first.height)/2)
            second.place(if(rtl) w-x2-second.width else x2,(h-second.height)/2)
        }
    }
}
