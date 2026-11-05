package dev.awc.nativeui

import android.animation.ValueAnimator
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.waitForUpOrCancellation
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.input.key.*
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.layoutId
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.json.JSONArray

/** One option of md-select (`SelectOptionData`, utils/select-options.ts). */
internal data class AWCSelectOptionData(val value:String,val label:String,val disabled:Boolean=false,val icon:String="",val iconColor:String="",
                                    val supportingText:String="",val selected:Boolean=false,val hidden:Boolean=false)
/** The slotted md-select-option children of one select, in authored order. */
internal class AWCSelectOptionCollector {
    private val entries=mutableStateMapOf<Any,AWCSelectOptionData>()
    private val order=mutableStateListOf<Any>()
    fun put(id:Any,o:AWCSelectOptionData) { if(id !in order) order+=id;if(entries[id]!=o) entries[id]=o }
    fun remove(id:Any) { order.remove(id);entries.remove(id) }
    val options:List<AWCSelectOptionData> get()=order.mapNotNull { entries[it] }
}
internal val LocalAWCSelectOptions=staticCompositionLocalOf<AWCSelectOptionCollector?> { null }
internal object AWCSelectOptions {
    fun init(v:Any?):AWCSelectOptionData? { val m=v as? Map<*,*> ?: return null;val value=m["value"]?.let { if(it is Number) java.math.BigDecimal(it.toString()).stripTrailingZeros().toPlainString() else it.toString() } ?: return null
        return AWCSelectOptionData(value,(m["label"] as? String) ?: value,m["disabled"]==true,(m["icon"] as? String).orEmpty(),(m["iconColor"] as? String).orEmpty(),(m["supportingText"] as? String).orEmpty(),m["selected"]==true) }
    /** The `options` property: a list, or a JSON string (malformed JSON degrades to an empty list). */
    fun inits(v:AWCValue):List<AWCSelectOptionData> = when(v) {
        is String->runCatching { awcList(JSONArray(v)) }.getOrDefault(emptyList()).mapNotNull(::init)
        else->awcList(v).mapNotNull(::init) }
}
/** md-select-option inside a select: registers its data (label = `label`, else its text content) and paints nothing. */
@Composable internal fun NativeSelectOption(p:Props,content:Slot?) {
    val collector=LocalAWCSelectOptions.current ?: return
    val identity=remember { Any() }
    val text=remember { AWCSlotTextRegistry() }
    Box(Modifier.size(0.dp)) { CompositionLocalProvider(LocalAWCSlotTextRegistry provides text) { content?.invoke("") } }
    val data=AWCSelectOptionData(p.str("value"),p.str("label").trim().ifEmpty { text.text.trim() },p.bool("disabled"),p.str("icon"),p.str("iconColor"),p.str("supportingText"),
        p.bool("selected"),p.bool("hidden"))
    SideEffect { collector.put(identity,data) }
    DisposableEffect(identity) { onDispose { collector.remove(identity) } }
}

/** The eight md-select hooks (`--md-select-*`); lengths are dp (= CSS px), colours `#RRGGBB[AA]`. */
@Immutable data class AWCSelectAppearance(val width:Double?=null,val minWidth:Double?=null,val caretColor:String?=null,val caretSize:Double?=null,
                                          val clearColor:String?=null,val trailingGap:Double?=null,val optionIconColor:String?=null,val spinnerSize:Double?=null) {
    fun merge(o:AWCSelectAppearance)=AWCSelectAppearance(o.width ?: width,o.minWidth ?: minWidth,o.caretColor ?: caretColor,o.caretSize ?: caretSize,o.clearColor ?: clearColor,
        o.trailingGap ?: trailingGap,o.optionIconColor ?: optionIconColor,o.spinnerSize ?: spinnerSize)
    companion object {
        /** CSS custom properties as authored on the host (`--md-select-caret-size: 30px`). */
        fun fromCss(css:Map<String,String>):AWCSelectAppearance { fun px(k:String)=css[k]?.replace("px","")?.trim()?.toDoubleOrNull()?.takeIf { it>=0 }
            fun c(k:String)=css[k]?.trim()?.takeIf { Regex("^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$").matches(it) }
            return AWCSelectAppearance(px("--md-select-width"),px("--md-select-min-width"),c("--md-select-caret-color"),px("--md-select-caret-size"),c("--md-select-clear-color"),
                px("--md-select-trailing-gap"),c("--md-select-option-icon-color"),px("--md-select-spinner-size")) }
        /** Typed values (Laboratory). */
        fun fromValues(v:Map<String,AWCValue>):AWCSelectAppearance {
            fun n(k:String)=(v[k] as? Number)?.toDouble()?.takeIf { it>=0 }
            fun s(k:String)=(v[k] as? String)?.takeIf { it.isNotEmpty() }
            return AWCSelectAppearance(n("width"),n("minWidth"),s("caretColor"),n("caretSize"),s("clearColor"),n("trailingGap"),s("optionIconColor"),n("spinnerSize")) }
    }
}
internal val LocalAWCSelectAppearance=staticCompositionLocalOf { AWCSelectAppearance() }
@Composable fun AWCSelectAppearanceScope(appearance:AWCSelectAppearance,content:@Composable ()->Unit)=
    CompositionLocalProvider(LocalAWCSelectAppearance provides LocalAWCSelectAppearance.current.merge(appearance),content=content)

/** md-select methods. Attach with [AWCSelectControllerScope]. */
class AWCSelectController {
    internal var runtime:AWCSelectRuntime?=null
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
internal val LocalAWCSelectController=staticCompositionLocalOf<AWCSelectController?> { null }
@Composable fun AWCSelectControllerScope(controller:AWCSelectController,content:@Composable ()->Unit)=CompositionLocalProvider(LocalAWCSelectController provides controller,content=content)

internal class AWCSelectRuntime {
    val field=AWCTextFieldController()
    var query by mutableStateOf("")
    var loaded by mutableStateOf<List<AWCSelectOptionData>?>(null)
    var customMessage by mutableStateOf("")
    var revealed by mutableStateOf(false)
    var focused by mutableStateOf(false)
    var lastEmit:String?=null
    var lastValidityKey:String?=null
    var openedByKey=false
    /** The menu's own first `open` sync (closed) has run: the select acts on the menu only after it. */
    var menuSynced=false
    var validityNow=AWCConstraintValidity.VALID
    var optionsNow:List<AWCSelectOptionData> = emptyList()
    var show:()->Unit={};var close:()->Unit={};var reset:()->Unit={}
}
/** Test hook: the select's state (open, value, caret rotation, focus) by node id. */
class AWCSelectInspection { val states=mutableMapOf<String,Map<String,Any?>>(); val events=mutableListOf<Triple<String,String,Any?>>() }
internal val LocalAWCSelectInspection=staticCompositionLocalOf<AWCSelectInspection?> { null }
@Composable fun AWCSelectInspectionScope(inspection:AWCSelectInspection,content:@Composable ()->Unit)=CompositionLocalProvider(LocalAWCSelectInspection provides inspection,content=content)

/**
 * md-select: an md-text-field trigger (read-only, `appear-focused` while open) and an md-menu listbox of radio option rows,
 * composed from the library's own renderers as the source composes its primitives. The menu presents in the nearest
 * [AWCMenuScope]; outside one it renders in flow.
 */
@Composable internal fun NativeSelect(p:Props,onEvent:EventSink,controlEvent:EventSink,slot:Slot?,formField:AWCFormField?,form:AWCFormState?) {
    val generated=remember { "select-"+java.util.UUID.randomUUID().toString().take(8) }
    val id=p.str("id").ifEmpty { generated }
    var value by awcState(p["value"]) { p.str("value") }
    var open by awcState(p["open"]) { p.bool("open") }
    val rt=remember { AWCSelectRuntime() }
    val controller=LocalAWCSelectController.current
    val registry=LocalNativeMenuRegistry.current
    val tokens=LocalAWCThemeTokens.current
    val appearance=LocalAWCSelectAppearance.current
    val inspection=LocalAWCInspection.current
    val selectInspection=LocalAWCSelectInspection.current
    val reduced=LocalAWCFieldReducedMotion.current ?: !ValueAnimator.areAnimatorsEnabled()
    val disabled=p.bool("disabled")
    val emit:(String,Any?)->Unit={ n,d-> selectInspection?.events?.add(Triple(n,id,d));controlEvent(n,d) }
    // Slotted md-select-option children register their data here; like the source's hidden options slot they paint nothing.
    val collector=remember { AWCSelectOptionCollector() }
    Box(Modifier.size(0.dp)) { CompositionLocalProvider(LocalAWCSelectOptions provides collector) { slot?.invoke("") } }
    val slotted=collector.options
    val options=rt.loaded ?: if(slotted.isNotEmpty()) slotted.filter { !it.hidden } else AWCSelectOptions.inits(p["options"])
    val display=options.firstOrNull { it.value==value }?.label ?: slotted.firstOrNull { it.hidden && it.value==value }?.label.orEmpty()
    val hasValue=value.isNotEmpty() && display.isNotEmpty()
    val accessibleName=p.str("label").ifEmpty { p.str("aria-label").ifEmpty { p.str("ariaLabel") } }.trim()
    val validity=when { rt.customMessage.isNotEmpty()->AWCConstraintValidity.of("customError",rt.customMessage)
        p.bool("required") && value.isEmpty()->AWCConstraintValidity.of("valueMissing",p.str("valueMissingLabel","Please select an item in the list.")); else->AWCConstraintValidity.VALID }
    val validationMessage=if(rt.revealed && !validity.valid) validity.validationMessage else ""
    val density=(p["density"] as? Number)?.toDouble()
    val rung=density?.takeIf { it in listOf(-1.0,-2.0,-3.0,-4.0) } ?: LocalAWCNativeDensity.current
    val insetLG=if(rung<=-4) 8.0 else if(rung<=-2) 12.0 else 16.0
    val tint=tokens["--md-sys-color-on-surface-variant"] ?: "#49454F"
    val anchorID="$id::trigger";val menuID="$id::menu"
    rt.validityNow=validity;rt.optionsNow=options
    LaunchedEffect(validity.key) { val k=validity.key;val last=rt.lastValidityKey;rt.lastValidityKey=k;if(last!=null && last!=k) emit("mdValidityChange",validity.eventValue) }
    // Read in composition (a SideEffect's own reads are not observed): the inspection follows focus changes.
    val focusedNow=rt.focused
    SideEffect {
        controller?.runtime=rt
        rt.show={ if(!disabled) open=true };rt.close={ open=false };rt.reset={ if(value.isNotEmpty()) { value="";emit("mdChange","") } }
        selectInspection?.states?.set(id,mapOf("open" to open,"value" to value,"display" to display,"focused" to focusedNow,"valid" to validity.valid))
    }
    // `@Watch('open')`: the host's open state drives the menu (its own exit runs on close).
    LaunchedEffect(open,registry) {
        val r=registry ?: return@LaunchedEffect
        // md-menu syncs its own (absent, so closed) `open` property in its first effect, in this same frame: act after it.
        if(!rt.menuSynced) { withFrameNanos { };rt.menuSynced=true }
        var c=r.controllers[menuID];var tries=0
        while(c==null && tries<20) { withFrameNanos { };c=r.controllers[menuID];tries++ }
        c ?: return@LaunchedEffect
        if(open) { if(!c.isOpen || c.closing) c.show(true,rt.openedByKey) } else if(c.isOpen && !c.closing) c.close()
        rt.openedByKey=false
    }
    // Opens / closes the menu in the same frame as the input that asked for it (the effect below follows later changes).
    fun syncMenuNow(o:Boolean,keyboard:Boolean) { val c=registry?.controllers?.get(menuID) ?: return;rt.menuSynced=true
        if(o) { if(!c.isOpen || c.closing) c.show(true,keyboard) } else if(c.isOpen && !c.closing) c.close() }
    fun selectValue(v:String) { if(value==v) { open=false;return };value=v;emit("mdChange",v);open=false;rt.field.setFocus() }
    fun clear() { if(disabled || value.isEmpty()) return;value="";emit("mdChange","");rt.field.setFocus() }
    val showClear=p.bool("clearable") && hasValue && !disabled
    val clearBounds=remember { arrayOfNulls<Rect>(1) }
    val fieldOrigin=remember { arrayOf(Offset.Zero) }
    val caretTurn=remember { Animatable(if(open) 1f else 0f) }
    LaunchedEffect(open,reduced) { val t=if(open) 1f else 0f;if(reduced) caretTurn.snapTo(t) else caretTurn.animateTo(t,tween(200,easing=CubicBezierEasing(.2f,0f,0f,1f))) }

    val trailing:@Composable ()->Unit={
        if(p.bool("loading")) Box(Modifier.size(24.dp).inspectAWCNode(inspection,"trailing","trailing").inspectAWCNode(inspection,"loading-spinner","loading-spinner"),contentAlignment=Alignment.Center) {
            val size=appearance.spinnerSize ?: 22.0
            AWCLoadingIndicatorAppearanceScope(AWCLoadingIndicatorAppearance(size=size,shapeSize=size)) {
                SelectSlotOr(slot,"loader") { AWCComponent("md-loading-indicator",mapOf("label" to p.str("loadingText","Loading…"))) } }
        } else Row(Modifier.inspectAWCNode(inspection,"trailing","trailing"),horizontalArrangement=Arrangement.spacedBy((appearance.trailingGap ?: 2.0).dp),verticalAlignment=Alignment.CenterVertically) {
            if(showClear) Box(Modifier.size(24.dp).onGloballyPositioned { clearBounds[0]=it.boundsInRoot() }.inspectAWCNode(inspection,"clear","clear")) {
                val color=appearance.clearColor ?: appearance.caretColor ?: tint
                AWCIconButtonAppearanceScope(AWCIconButtonAppearance(iconColor=color,stateLayerColor=color,iconSize=18.0,width=24.0,height=24.0)) {
                    AWCComponent("md-icon-button",mapOf("size" to "xs","icon" to p.str("clearIcon","close"),"aria-label" to p.str("clearLabel","Clear selection"),"shapeMorph" to false,
                        "groupTabindex" to -1,"toggle" to false),onEvent={ n,_-> if(n=="mdClick") clear() }) }
            }
            val size=appearance.caretSize ?: 24.0
            val turn=caretTurn.value
            SideEffect { selectInspection?.states?.set("$id::caret",mapOf("rotation" to turn.toDouble())) }
            Box(Modifier.size(size.dp).rotate(180f*turn).inspectAWCNode(inspection,"caret","caret"),contentAlignment=Alignment.Center) {
                androidx.compose.runtime.CompositionLocalProvider(androidx.compose.material3.LocalContentColor provides awcColor(appearance.caretColor ?: tint,Color.Black)) {
                    SelectSlotOr(slot,"dropdown-icon") { AWCMaterialSymbol(p.str("dropdownIcon","arrow_drop_down"),size=size.dp) } }
            }
        }
    }
    val hooks=AWCFieldHooks(focus={ f-> rt.focused=f },trailing=trailing,controller=rt.field,event={ _,_-> })
    val fieldProps:Props=buildMap {
        put("variant",p.str("variant","outlined"));put("label",p.str("label"));if(p.str("label").isEmpty() && accessibleName.isNotEmpty()) put("aria-label",accessibleName)
        put("placeholder",if(hasValue) "" else p.str("placeholder"));put("readOnly",true);put("disabled",disabled);put("required",p.bool("required"))
        put("error",p.bool("error") || validationMessage.isNotEmpty());put("errorText",p.str("errorText").ifEmpty { validationMessage })
        put("reserveSupportingSpace",p.bool("reserveSupportingSpace"));put("supportingText",p.str("supportingText"));if(density!=null) put("density",density)
        put("appearFocused",open);put("value",display)
    }
    val q=if(p.bool("filterable")) rt.query.trim().lowercase() else ""
    val listOptions=if(q.isEmpty()) options else options.filter { it.label.lowercase().contains(q) || it.supportingText.lowercase().contains(q) }
    val emptyText=when { p.bool("loading")->"";options.isEmpty()->p.str("noOptionsText","No options");q.isNotEmpty() && listOptions.isEmpty()->p.str("noResultsText","No results");else->"" }
    val minW=appearance.minWidth
    val host=Modifier.let { if(appearance.width!=null) it.width(maxOf(appearance.width,minW ?: 0.0).dp) else it.fillMaxWidth() }.let { if(minW!=null) it.widthIn(min=minW.dp) else it }
    Column(host) {
        // :host sets --md-text-field-padding-inline-end: inset-lg.
        AWCTextFieldAppearanceScope(AWCTextFieldAppearance(paddingInlineEnd=insetLG)) {
            Box(Modifier.awcMenuAnchor(anchorID,null).inspectAWCNode(inspection,"field","field").onGloballyPositioned { fieldOrigin[0]=it.boundsInRoot().topLeft }
                // The source's onClick on its field toggles the menu (the clear button stops its own click). Observed in the
                // Initial pass: the inner read-only text field consumes the press and release on the main pass.
                .pointerInput(disabled,showClear) { awaitEachGesture {
                    val down=awaitFirstDown(false,PointerEventPass.Initial)
                    var up:androidx.compose.ui.input.pointer.PointerInputChange?=null
                    while(true) { val e=awaitPointerEvent(PointerEventPass.Initial);val c=e.changes.firstOrNull { it.id==down.id } ?: break
                        if(!c.pressed) { up=c;break } }
                    val u=up ?: return@awaitEachGesture
                    val inside=u.position.x>=0 && u.position.y>=0 && u.position.x<size.width && u.position.y<size.height
                    val clearHit=showClear && clearBounds[0]?.contains(fieldOrigin[0]+down.position)==true
                    if(inside && !disabled && !clearHit) { open=!open;syncMenuNow(open,false) } } }
                // The key's time is the menu motion's request time of a key (the scope's window listener sets it for window input).
                // md-select's host keydown listener: ArrowDown / Enter / Space open, Escape closes (keys inside the menu are the menu's).
                .onPreviewKeyEvent { e-> if(e.type!=KeyEventType.KeyDown || disabled) false else when(e.key) {
                    Key.DirectionDown,Key.Enter,Key.NumPadEnter,Key.Spacebar-> if(!open) { registry?.inputTime=e.nativeKeyEvent.eventTime.toDouble();open=true;syncMenuNow(true,true);true } else false
                    Key.Escape-> if(open) { registry?.inputTime=e.nativeKeyEvent.eventTime.toDouble();open=false;rt.field.setFocus();true } else false
                    else->false } }) {
                // The inner md-text-field measures its parts under `<id>::trigger` (the host keeps `<id>`).
                CompositionLocalProvider(LocalAWCInspection provides inspection?.copy(id=anchorID,entered=true,parentId=inspection.id)) {
                    NativeTextField(fieldProps,{ _,_-> },{ _,_-> },null,null,null,hooks) }
            }
        }
        // The menu and its rows measure under their own ids (`<id>::menu`, `<id>::opt<i>`) in the select's collector.
        CompositionLocalProvider(LocalNativeMenuCollector provides inspection?.collector) {
        AWCComponent("md-menu",buildMap { put("id",menuID);put("anchor",anchorID);put("placement",p.str("placement","bottom-start"));put("matchAnchorWidth",p.bool("matchTriggerWidth",true) || p.bool("fullWidth"))
                put("emptyText",emptyText);put("listbox",true);put("listLabel",accessibleName.ifEmpty { "Options" });p["maxHeight"]?.let { put("maxHeight",it) };if(density!=null) put("density",density) },
            onEvent={ n,_-> when(n) { "mdOpen"->{ if(!open) open=true;if(rt.lastEmit!="open") { rt.lastEmit="open";emit("mdOpen",null) } }
                "mdClose"->{ if(open) open=false;if(rt.query.isNotEmpty()) rt.query="";if(rt.lastEmit!="close") { rt.lastEmit="close";emit("mdClose",null) } } } }) { s->
            when(s) {
                ""-> if(!p.bool("loading")) listOptions.forEachIndexed { i,o-> key(o.value) {
                    AWCComponent("md-menu-item",mapOf("id" to "$id::opt$i","presentation" to "option","type" to "radio","checkPosition" to "start","keepOpen" to true,"disabled" to o.disabled,
                        "selected" to (o.value==value),"headline" to o.label,"supportingText" to o.supportingText),onEvent={ n,_-> if(n=="mdClick") selectValue(o.value) }) { rs->
                        if(rs=="leading-icon" && o.icon.isNotEmpty()) androidx.compose.runtime.CompositionLocalProvider(androidx.compose.material3.LocalContentColor provides
                            awcColor(o.iconColor.ifEmpty { appearance.optionIconColor ?: tint },Color.Black)) { AWCMaterialSymbol(o.icon) }
                    } } }
                "header"-> if(p.bool("loading")) Box(Modifier.fillMaxWidth().inspectAWCNode(inspection,"loading-bar","loading-bar").padding(insetLG.dp)) {
                        Box(Modifier.fillMaxWidth().inspectAWCNode(inspection,"loading-progress","loading-progress")) {
                            AWCComponent("md-progress-indicator",mapOf("variant" to "linear","indeterminate" to true,"wave" to true,"label" to p.str("loadingText","Loading…"))) } }
                    else if(p.bool("filterable")) SelectSearchField(rt,p,tokens,inspection)
            }
        }
        }
    }
}
/** The slotted content of [name], else [fallback] (a slot renders its fallback content while nothing is assigned to it). */
@Composable internal fun SelectSlotOr(slot:Slot?,name:String,fallback:@Composable ()->Unit) {
    // A plain layout (not SubcomposeLayout): composite fields query their trailing content's intrinsic size.
    androidx.compose.ui.layout.Layout({
        Box(Modifier.layoutId("authored")) { slot?.invoke(name) }
        Box(Modifier.layoutId("fallback")) { fallback() }
    }) { ms,c->
        val authored=ms.first { it.layoutId=="authored" }.measure(c)
        val shown=if(authored.width>0 || authored.height>0) authored else ms.first { it.layoutId=="fallback" }.measure(c)
        layout(shown.width,shown.height) { shown.place(0,0) }
    }
}
private val SelectRoboto=androidx.compose.ui.text.font.FontFamily(androidx.compose.ui.text.font.Font(R.font.awc_roboto_regular,androidx.compose.ui.text.font.FontWeight.Normal))
/** `.md-select__search`: the filter input pinned in the menu header (padding 12 44 12 16, surface-container fill, outline-variant bottom border). */
@Composable private fun SelectSearchField(rt:AWCSelectRuntime,p:Props,tokens:Map<String,String>,inspection:AWCInspectionContext?) {
    val border=awcColor(tokens["--md-sys-color-outline-variant"] ?: "#CAC4D0",Color.Gray)
    val style=TextStyle(fontFamily=SelectRoboto,fontSize=16.sp,lineHeight=19.sp,color=awcColor(tokens["--md-sys-color-on-surface"] ?: "#1D1B20",Color.Black))
    Box(Modifier.fillMaxWidth().inspectAWCNode(inspection,"search-wrap","search-wrap").inspectAWCNode(inspection,"search","search")
        .background(awcColor(tokens["--md-sys-color-surface-container"] ?: "#F3EDF7",Color.White))
        .drawBehind { drawRect(border,topLeft=Offset(0f,size.height-1.dp.toPx()),size=androidx.compose.ui.geometry.Size(size.width,1.dp.toPx())) }
        .padding(start=16.dp,end=44.dp,top=12.dp,bottom=13.dp)) {
        if(rt.query.isEmpty()) androidx.compose.material3.Text(p.str("searchPlaceholder","Search…"),style=style.copy(color=awcColor(tokens["--md-sys-color-on-surface-variant"] ?: "#49454F",Color.Gray)),maxLines=1)
        BasicTextField(rt.query,{ rt.query=it },Modifier.fillMaxWidth().height(19.dp).semantics { contentDescription=p.str("filterLabel").ifEmpty { if(p.str("label").isEmpty()) "Filter options" else "Filter ${p.str("label")}" } },
            textStyle=style,singleLine=true,cursorBrush=SolidColor(style.color))
    }
}
