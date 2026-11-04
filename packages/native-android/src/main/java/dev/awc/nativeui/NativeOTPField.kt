package dev.awc.nativeui

import androidx.compose.foundation.border
import androidx.compose.foundation.background
import androidx.compose.foundation.hoverable
import androidx.compose.foundation.interaction.HoverInteraction
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.input.key.*
import androidx.compose.ui.platform.ClipEntry
import androidx.compose.ui.platform.Clipboard
import androidx.compose.ui.platform.ClipboardManager
import androidx.compose.ui.platform.LocalClipboard
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.PlatformTextStyle
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.LineHeightStyle
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.text.BasicText
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlin.math.max
import kotlin.math.roundToInt

// md-otp-field: one BasicTextField per character, the source's single sanitizing pipeline (strip whitespace → transform →
// validation-type filter → clamp) for typing, paste, autofill and programmatic writes, the contiguous value model, per-cell
// Tab stops, completion / auto-submit and form validity.

/** The seven md-otp-field hooks (`--md-otp-field-*`, dp; colours #RRGGBB or #RRGGBBAA). */
@Immutable data class AWCOTPFieldAppearance(val cellGap:Double?=null,val cellHeight:Double?=null,val cellShape:Double?=null,val cellWidth:Double?=null,
                                            val focusColor:String?=null,val fontSize:Double?=null,val outlineColor:String?=null) {
    private fun l(v:Double?)=v?.takeIf { it.isFinite() && it>=0 }
    internal fun normalized()=AWCOTPFieldAppearance(l(cellGap),l(cellHeight),l(cellShape),l(cellWidth),switchColorHex(focusColor),l(fontSize),switchColorHex(outlineColor))
    fun merge(o:AWCOTPFieldAppearance)=AWCOTPFieldAppearance(o.cellGap ?: cellGap,o.cellHeight ?: cellHeight,o.cellShape ?: cellShape,o.cellWidth ?: cellWidth,
        o.focusColor ?: focusColor,o.fontSize ?: fontSize,o.outlineColor ?: outlineColor)
    companion object {
        fun fromValues(v:Map<String,AWCValue>):AWCOTPFieldAppearance {
            fun n(k:String)=(v[k] as? Number)?.toDouble()
            fun c(k:String)=(v[k] as? String)?.ifEmpty { null }
            return AWCOTPFieldAppearance(n("cellGap"),n("cellHeight"),n("cellShape"),n("cellWidth"),c("focusColor"),n("fontSize"),c("outlineColor")).normalized() }
    }
}
internal val LocalAWCOTPFieldAppearance=staticCompositionLocalOf { AWCOTPFieldAppearance() }
@Composable fun AWCOTPFieldAppearanceScope(appearance:AWCOTPFieldAppearance,content:@Composable ()->Unit)=
    CompositionLocalProvider(LocalAWCOTPFieldAppearance provides LocalAWCOTPFieldAppearance.current.merge(appearance.normalized()),content=content)

/** setFocus / clear / getValidity / setCustomValidity / checkValidity / reportValidity. */
class AWCOTPFieldController {
    internal var runtime:OTPFieldRuntime?=null
    val isConnected get()=runtime!=null
    /** Focuses the first empty cell (the last cell when the code is complete). */
    fun setFocus() { runtime?.focusFirstEmpty() }
    /** Clears the code without mdInput / mdChange (programmatic writes stay silent). */
    fun clear() { runtime?.clear?.invoke() }
    fun getValidity():AWCConstraintValidity=runtime?.validity?.invoke() ?: AWCConstraintValidity.VALID
    fun setCustomValidity(message:String) { runtime?.customMessage=message }
    fun checkValidity():Boolean { val r=runtime ?: return true;return r.barred() || r.validity().valid }
    fun reportValidity():Boolean { val r=runtime ?: return true
        if(r.barred() || r.validity().valid) return true
        r.revealed=true;android.os.Handler(android.os.Looper.getMainLooper()).post { r.focusFirstEmpty() };return false }
    /** The current code. */
    val value:String get()=runtime?.value ?: ""
    /** Test/host helper: drop focus from the field (the page focusing elsewhere). */
    fun runtimeBlur() { runtime?.blur?.invoke() }
}
internal val LocalAWCOTPFieldController=staticCompositionLocalOf<AWCOTPFieldController?> { null }
@Composable fun AWCOTPFieldControllerScope(controller:AWCOTPFieldController,content:@Composable ()->Unit)=
    CompositionLocalProvider(LocalAWCOTPFieldController provides controller,content=content)

internal val LocalAWCOTPFieldInspector=staticCompositionLocalOf<((Map<String,Map<String,Any?>>)->Unit)?> { null }
/** Opt-in values of the OTP field's nodes (host state, every cell's border / text), keyed by part name. */
@Composable fun AWCOTPFieldInspectionScope(onField:(Map<String,Map<String,Any?>>)->Unit,content:@Composable ()->Unit)=
    CompositionLocalProvider(LocalAWCOTPFieldInspector provides onField,content=content)

internal class OTPFieldModel(val length:Double,val validationType:String,val transform:String,val mask:Boolean,val autoSubmit:Boolean,val groupSize:Double,
                             val inputMode:String,val name:String,val disabled:Boolean,val readOnly:Boolean,val required:Boolean,val error:Boolean,
                             val errorText:String,val supportingText:String,val label:String,val cellLabelTemplate:String,val valueMissingLabel:String,
                             val incompleteLabel:String,val density:Double?,val reserveSupportingSpace:Boolean,val hidden:Boolean) {
    /** `length` hardened against zero / negative / fractional authoring. */
    val cellCount:Int get()=kotlin.math.floor(length).let { if(it.isFinite() && it>0) minOf(it,64.0).toInt() else 1 }
    val group:Int get()=kotlin.math.floor(groupSize).let { if(it.isFinite() && it>0) it.toInt() else 0 }
    val effectiveInputMode get()=inputMode.ifEmpty { if(validationType=="numeric") "numeric" else "text" }
    /** The one value pipeline: strip whitespace → transform → validation-type filter → clamp (`rejected`: the filter dropped characters). */
    fun sanitize(raw:String):Pair<String,Boolean> {
        val stripped=raw.filterNot { it.isWhitespace() }
        val transformed=if(transform=="uppercase") stripped.uppercase(java.util.Locale.ROOT) else stripped
        val kept=when(validationType) {
            "numeric"->transformed.filter { it in '0'..'9' }
            "alpha"->transformed.filter { it in 'a'..'z' || it in 'A'..'Z' }
            "alphanumeric"->transformed.filter { it in '0'..'9' || it in 'a'..'z' || it in 'A'..'Z' }
            else->transformed
        }
        return kept.take(cellCount) to (kept.length!=transformed.length)
    }
    companion object {
        private fun n(v:AWCValue?):Double?=when(v) { is Number->v.toDouble(); is String->v.trim().toDoubleOrNull(); else->null }
        fun of(p:Props):OTPFieldModel { fun s(k:String,d:String="")=(p[k] as? String) ?: (p[k] as? Number)?.let { x-> if(x.toDouble()==kotlin.math.floor(x.toDouble())) x.toLong().toString() else x.toString() } ?: d
            val vt=s("validationType").takeIf { it in setOf("numeric","alpha","alphanumeric","none") } ?: "numeric"
            return OTPFieldModel(n(p["length"]) ?: 6.0,vt,if(s("transform")=="uppercase") "uppercase" else "none",p.bool("mask"),p.bool("autoSubmit"),n(p["groupSize"]) ?: 0.0,
                s("inputMode",s("inputmode")),s("name"),p.bool("disabled"),p.bool("readOnly") || p.bool("readonly"),p.bool("required"),p.bool("error"),s("errorText"),
                s("supportingText"),if(p.containsKey("label")) s("label") else "One-time code",if(p.containsKey("cellLabelTemplate")) s("cellLabelTemplate") else "Character {index} of {length}",
                if(p.containsKey("valueMissingLabel")) s("valueMissingLabel") else "Please enter the complete code.",s("incompleteLabel"),
                n(p["density"])?.takeIf { it in setOf(0.0,-1.0,-2.0,-3.0,-4.0) },p.bool("reserveSupportingSpace"),p.bool("hidden"))
        }
    }
}

internal class OTPFieldRuntime {
    var value by mutableStateOf("")
    var focusedIndex by mutableStateOf<Int?>(null)
    var hoverIndex by mutableStateOf<Int?>(null)
    var customMessage by mutableStateOf("")
    var revealed by mutableStateOf(false)
    var selectAll by mutableIntStateOf(0)            // bumps when a cell's character must be selected (select-on-focus)
    var selectIndex=-1
    /** Per cell: the raw text of the edit handled since the cell last recomposed (the input's echo on blur is ignored). */
    val handledRaw=mutableMapOf<Int,String>()
    var lastCommitted=""
    var lastValidityKey:String?=null
    var lastProp:AWCValue?=null
    var started=false
    var count=6
    val requesters=mutableListOf<FocusRequester>()
    var validity:()->AWCConstraintValidity={ AWCConstraintValidity.VALID }
    var barred:()->Boolean={ false }
    var clear:(()->Unit)?=null
    var blur:(()->Unit)?=null
    fun requester(i:Int):FocusRequester { while(requesters.size<=i) requesters.add(FocusRequester());return requesters[i] }
    fun focusCell(index:Int) { val i=index.coerceIn(0,count-1);runCatching { requester(i).requestFocus() };selectIndex=i;selectAll++ }
    fun focusFirstEmpty() { val filled=value.length;focusCell(if(filled>=count) count-1 else filled) }
}

private val OTPRoboto=FontFamily(Font(R.font.awc_roboto_regular,FontWeight.Normal))
private const val ROBOTO_ASCENT=1900.0/2048.0
private const val ROBOTO_DESCENT=500.0/2048.0

/** The clipboard of a cell: a paste is the group's (whole-value replace from cell 0), the text system inserts nothing. */
@Suppress("DEPRECATION")
private class OTPClipboardManager(val base:ClipboardManager,val onPaste:(String)->Boolean):ClipboardManager by base {
    override fun getText():AnnotatedString? { val t=base.getText() ?: return null;return if(onPaste(t.text)) null else t }
}
private class OTPClipboard(val base:Clipboard,val onPaste:(String)->Boolean):Clipboard by base {
    override suspend fun getClipEntry():ClipEntry? { val e=base.getClipEntry() ?: return null
        val text=e.clipData.takeIf { it.itemCount>0 }?.getItemAt(0)?.text?.toString() ?: return e
        return if(onPaste(text)) null else e }
}

@Suppress("DEPRECATION")
@Composable
internal fun NativeOTPField(p:Props,onEvent:EventSink,controlEvent:EventSink,slot:Slot?,formField:AWCFormField?,form:AWCFormState?) {
    val m=OTPFieldModel.of(p)
    if(m.hidden) return
    val rt=remember { OTPFieldRuntime() }
    val focusScope=rememberCoroutineScope()
    val count=m.cellCount;rt.count=count
    val appearance=LocalAWCOTPFieldAppearance.current
    val controller=LocalAWCOTPFieldController.current
    val inspector=LocalAWCOTPFieldInspector.current
    val inspection=LocalAWCInspection.current
    val actions=LocalAWCAction.current;val target=LocalAWCActionTarget.current
    val targetID=remember { java.util.UUID.randomUUID().toString() }
    val emitControl by rememberUpdatedState(controlEvent)
    val tokens=LocalAWCThemeTokens.current
    val scale=resolveAWCDensity(p["density"],LocalAWCNativeDensity.current)
    val reduced=LocalAWCFieldReducedMotion.current ?: !android.animation.ValueAnimator.areAnimatorsEnabled()
    val focusManager=androidx.compose.ui.platform.LocalFocusManager.current
    fun emit(name:String,detail:AWCValue) {
        dispatchNativeAction(AWCActionEvent(name,"md-otp-field",(detail as? Map<*,*>)?.entries?.associate { it.key.toString() to it.value } ?: emptyMap(),cancelable=false,targetID=target?.id ?: targetID,rawDetail=detail),
            actions,target?.listeners?.invoke().orEmpty())
        emitControl(name,detail)
    }
    val disabled=m.disabled
    if(!rt.started) { rt.started=true;val clean=m.sanitize(p.str("value")).first;rt.value=clean;rt.lastCommitted=clean;rt.lastProp=p["value"] }
    val len=rt.value.length
    val validity=run {
        if(rt.customMessage.isNotEmpty()) AWCConstraintValidity.of("customError",rt.customMessage)
        else { val incomplete=m.required && m.incompleteLabel.isNotEmpty() && len>0 && len<count
            if(m.required && len==0 || incomplete) AWCConstraintValidity.of("valueMissing",if(incomplete) m.incompleteLabel else m.valueMissingLabel) else AWCConstraintValidity.VALID } }
    val validationMessage=if(rt.revealed && !validity.valid) validity.validationMessage else ""
    val hasError=m.error || validationMessage.isNotEmpty()
    val supportText=run { val alt=m.errorText.ifEmpty { validationMessage };if(hasError && alt.isNotEmpty()) alt else m.supportingText }
    rt.validity={ validity };rt.barred={ disabled || m.readOnly }
    fun write(next:String) { rt.value=next;formField?.value=next }
    rt.clear={ write("");rt.lastCommitted="" }
    rt.blur={ focusManager.clearFocus(true) }
    SideEffect { controller?.runtime=rt;formField?.validityOverride={ val v=rt.validity();if(v.valid) null else v.validationMessage } }
    DisposableEffect(Unit) { onDispose { if(controller?.runtime===rt) controller.runtime=null } }
    LaunchedEffect(validity.key) { val k=validity.key;if(rt.lastValidityKey!=null && rt.lastValidityKey!=k) emit("mdValidityChange",validity.eventValue);rt.lastValidityKey=k
        if(rt.revealed && validity.valid) rt.revealed=false }
    LaunchedEffect(p["value"]) { val v=p["value"];if(v==rt.lastProp) return@LaunchedEffect
        rt.lastProp=v;val clean=m.sanitize(v?.toString() ?: "").first;if(clean!=rt.value) rt.value=clean }
    LaunchedEffect(m.length,m.validationType,m.transform) { val clean=m.sanitize(rt.value).first;if(clean!=rt.value) write(clean) }
    LaunchedEffect(m.name) { rt.revealed=false }
    LaunchedEffect(p["_awcFormReset"]) { if(p["_awcFormReset"]!=null && p["_awcFormReset"]!=0) { rt.revealed=false;rt.value="";rt.lastCommitted="" } }
    LaunchedEffect(formField?.error) { if(formField?.error!=null) rt.revealed=true }
    LaunchedEffect(disabled) { if(disabled) rt.revealed=false }

    // Tokens and density-tapered metrics (md-otp-field.css §1).
    fun color(name:String,fallback:String)=switchColorHex(tokens["--md-sys-color-$name"]) ?: fallback
    fun length(name:String)=tokens[name]?.replace("px","")?.trim()?.toDoubleOrNull()
    val cellW=appearance.cellWidth ?: max(32.0,48+scale*4);val cellH=appearance.cellHeight ?: max(40.0,56+scale*4)
    val gap=appearance.cellGap ?: (if(scale<=-3) 4.0 else length("--md-sys-spacing-gap-sm") ?: 8.0)
    val shape=appearance.cellShape ?: length("--md-sys-shape-corner-small") ?: 8.0
    val fontSize=appearance.fontSize ?: max(16.0,24+scale)
    val outline=appearance.outlineColor ?: color("outline","#79747E");val focusColor=appearance.focusColor ?: color("primary","#6750A4")
    val errorColor=color("error","#B3261E");val onSurface=color("on-surface","#1C1B1F");val supportColor=color("on-surface-variant","#49454F")
    fun alpha(hex:String,a:Double)=hex.take(7)+"%02X".format((a*255).roundToInt())
    val disabledBorder=alpha(onSurface,tokens["--md-sys-state-disabled-container-opacity"]?.toDoubleOrNull() ?: 0.12)
    val disabledContent=alpha(onSurface,tokens["--md-sys-state-disabled-content-opacity"]?.toDoubleOrNull() ?: 0.38)
    val sepW=max(8.0,12+scale);val dot=max(6.0,8+scale*0.5);val supportFont=max(10.0,12+scale*0.5)
    fun border(i:Int):Pair<String,Double> {
        if(disabled) return disabledBorder to 1.0
        val focused=rt.focusedIndex==i;val hovered=rt.hoverIndex==i && !m.readOnly
        if(hasError) return if(focused) errorColor to 3.0 else (if(hovered) color("on-error-container","#8C1D18") else errorColor) to 1.0
        if(focused) return focusColor to 3.0
        return (if(hovered) onSurface else outline) to 1.0
    }
    val textColor=if(disabled) disabledContent else if(hasError) errorColor else onSurface
    val chars=(0 until count).map { rt.value.getOrNull(it)?.toString() ?: "" }

    // Border colour: `transition: border-color 100ms standard`; a cell taking focus snaps (`:focus { transition: none }`).
    val frame=remember { mutableDoubleStateOf(-1.0) }
    val tracks=remember(count) { List(count) { FieldColorTrack(border(it).first) } }
    val now=frame.doubleValue.let { if(it<0) Double.NaN else it }
    // Reduced motion: `transition-duration: 0.01ms !important` (not `transition: none`): the style change's own frame still shows the
    // value transitioned from (cells a burst of keys passed through keep their focus border for that frame, as Chrome does).
    val duration=if(reduced) 0.01 else (tokens["--md-sys-motion-duration-short2"]?.removeSuffix("ms")?.trim()?.toDoubleOrNull() ?: 100.0)
    val curve=accordionCubicBezierCurve(tokens["--md-sys-motion-easing-standard"]) ?: listOf(0.2,0.0,0.0,1.0)
    tracks.forEachIndexed { i,t-> t.set(border(i).first,now,if(rt.focusedIndex==i) 0.0 else duration,curve) }
    val anyRunning=tracks.any { it.running(now) }
    // Undispatched from the composition that set a target: the first tick is the next frame and the transition starts at the
    // composing frame (Chrome starts it at the style change's frame), as in md-text-field.
    val frameMs=1000.0/(androidx.compose.ui.platform.LocalView.current.display?.refreshRate?.takeIf { it>0f } ?: 60f)
    val tickScope=rememberCoroutineScope();val ticker=remember { arrayOfNulls<kotlinx.coroutines.Job>(1) }
    // Ticked inside the frame callback, so this frame's recomposition already reads the new frame time.
    SideEffect { if(anyRunning && ticker[0]?.isActive!=true) ticker[0]=tickScope.launch(start=kotlinx.coroutines.CoroutineStart.UNDISPATCHED) {
        while(isActive) { val more=withFrameMillis { ms-> val ft=ms.toDouble();tracks.forEach { it.tick(ft,frameMs) };frame.doubleValue=ft;tracks.any { it.running(ft) } }
            if(!more) break } } }
    val t=frame.doubleValue.let { if(it<0) 0.0 else it }

    // Editing (handleInput / handleKeyDown / handlePaste / focusout).
    fun update(next:String):Boolean { if(next==rt.value) return false;write(next);return true }
    fun commit() { if(rt.value==rt.lastCommitted) return;rt.lastCommitted=rt.value;emit("mdChange",rt.value) }
    fun maybeComplete(prev:String,force:Boolean) {
        if(rt.value.length<count) return
        if(prev.length>=count && !force) return
        commit();emit("mdComplete",mapOf("value" to rt.value))
        // requestSubmit() without a submitter: the form submits (validation runs); the default button is not clicked.
        if(m.autoSubmit) form?.submit()
    }
    fun removing(prev:String,i:Int)=prev.removeRange(i,i+1)
    // Focus moves once the text input has finished the edit in progress: moving it inside onValueChange hands the same
    // commit to the next cell's input session too (the next keystroke goes to the new cell).
    fun later(action:()->Unit) { focusScope.launch { action() } }
    fun edited(i:Int,next:TextFieldValue,cur:TextFieldValue):TextFieldValue {
        if(next.composition!=null) return next
        if(next.text==cur.text) return next
        // The text input re-sends its own buffer when it loses focus (onBlur → onValueChange) before this cell recomposed with
        // the value the pipeline returned: that is the edit already applied, not a new one.
        if(rt.handledRaw[i]==next.text) return cur
        rt.handledRaw[i]=next.text
        if(disabled || m.readOnly) return cur
        val prev=rt.value;val had=chars[i];var raw=next.text
        // A keystroke into a filled cell whose character is not selected: it replaces the cell.
        if(had.isNotEmpty() && raw.length==had.length+1) {
            val data=if(raw.startsWith(had)) raw.drop(had.length) else if(raw.endsWith(had)) raw.dropLast(had.length) else null
            if(data!=null) { val one=m.sanitize(data).first
                if(one.isNotEmpty()) { val a=prev.toCharArray();a[i]=one[0];val changed=update(String(a));later { rt.focusCell(minOf(i+1,count-1)) }
                    if(changed) emit("mdInput",rt.value);maybeComplete(prev,false);return TextFieldValue(rt.value.getOrNull(i)?.toString() ?: "",TextRange(1)) }
                raw=data }
        }
        if(raw.isEmpty()) { if(i<prev.length && update(removing(prev,i))) emit("mdInput",rt.value);return TextFieldValue(rt.value.getOrNull(i)?.toString() ?: "") }
        val (clean,rejected)=m.sanitize(raw)
        if(rejected) emit("mdInvalidInput",mapOf("attempted" to raw,"reason" to "input-change"))
        if(clean.isEmpty()) return cur
        val nextValue:String;val targetIndex:Int
        if(clean.length>=count) { nextValue=clean.take(count);targetIndex=count-1 }   // full-code burst (autofill / IME)
        else { val start=minOf(i,prev.length);val a=StringBuilder(prev)
            clean.forEachIndexed { k,c-> if(start+k<a.length) a.setCharAt(start+k,c) else a.append(c) }
            nextValue=a.take(count).toString();targetIndex=minOf(start+clean.length,count-1) }
        val changed=update(nextValue);later { rt.focusCell(targetIndex) }
        if(changed) emit("mdInput",rt.value);maybeComplete(prev,false)
        return TextFieldValue(rt.value.getOrNull(i)?.toString() ?: "",TextRange(1))
    }
    fun key(i:Int,k:String):Boolean {
        if(disabled) return false
        val prev=rt.value
        return when(k) {
            "Enter"->{ form?.requestSubmit();true }
            "Backspace"->{ if(!m.readOnly) { if(i<prev.length) { if(update(removing(prev,i))) emit("mdInput",rt.value) }
                else if(i>0) { val tt=i-1;rt.focusCell(tt);if(tt<prev.length && update(removing(prev,tt))) emit("mdInput",rt.value) } };true }
            "Delete"->{ if(!m.readOnly && i<prev.length && update(removing(prev,i))) emit("mdInput",rt.value);true }
            "ArrowLeft"->{ rt.focusCell(i-1);true }
            "ArrowRight"->{ rt.focusCell(i+1);true }
            "Home"->{ rt.focusCell(0);true }
            "End"->{ rt.focusCell(count-1);true }
            // Every cell is a Tab stop, in order: Tab past the last cell leaves the group.
            "Tab"->if(i<count-1) { rt.focusCell(i+1);true } else false
            "Shift+Tab"->if(i>0) { rt.focusCell(i-1);true } else false
            else->false
        }
    }
    fun paste(text:String):Boolean {
        if(disabled || m.readOnly) return true
        val prev=rt.value;val (clean,rejected)=m.sanitize(text)
        if(rejected) emit("mdInvalidInput",mapOf("attempted" to text,"reason" to "input-paste"))
        if(clean.isEmpty()) return true
        // Whole-value replace from cell 0, whichever cell was pasted into; a complete paste always announces completion.
        val changed=update(clean);later { rt.focusCell(minOf(clean.length,count-1)) }
        if(changed) emit("mdInput",rt.value);maybeComplete(prev,true);return true
    }
    fun focusChanged(i:Int,f:Boolean) {
        // A focus move is a style change of its own (Chrome's focus() recalculates style): the cell taking focus snaps to the
        // focus border now, so a cell focused and left within one frame (three Backspaces) still transitions from it.
        if(f) { rt.focusedIndex=i;rt.selectIndex=i;rt.selectAll++;tracks.getOrNull(i)?.set(border(i).first,now,0.0,curve) }
        else { if(rt.focusedIndex==i) rt.focusedIndex=null
            // Commit when focus leaves the whole group (not when it moves to another cell).
            android.os.Handler(android.os.Looper.getMainLooper()).post { if(rt.focusedIndex==null) commit() } }
    }

    SideEffect { inspector?.invoke(buildMap {
        put("md-otp-field",mapOf("value" to rt.value,"focused" to (rt.focusedIndex!=null),"focusedIndex" to rt.focusedIndex,"validationMessage" to validationMessage,"valid" to validity.valid,"error" to hasError))
        for(i in 0 until count) put("cell-$i",mapOf("border" to tracks[i].hex(t),"borderWidth" to border(i).second,"text" to chars[i],"color" to textColor,"focused" to (rt.focusedIndex==i),"secure" to m.mask,"fontSize" to fontSize))
        put("supporting-text",mapOf("text" to supportText,"color" to (if(disabled) disabledContent else if(hasError) errorColor else supportColor),"role" to (if(hasError && supportText.isNotEmpty()) "alert" else "")))
    }) }

    val baseClipboardManager=LocalClipboardManager.current;val baseClipboard=LocalClipboard.current
    val clipboardManager=remember(baseClipboardManager) { OTPClipboardManager(baseClipboardManager) { paste(it) } }
    val clipboard=remember(baseClipboard) { OTPClipboard(baseClipboard) { paste(it) } }
    val line=kotlin.math.ceil(fontSize*(ROBOTO_ASCENT+ROBOTO_DESCENT))+2
    val style=TextStyle(fontFamily=OTPRoboto,fontWeight=FontWeight.Normal,fontSize=fontSize.sp,lineHeight=line.sp,textAlign=TextAlign.Center,color=awcColor(textColor,Color.Black),
        lineHeightStyle=LineHeightStyle(LineHeightStyle.Alignment.Center,LineHeightStyle.Trim.None),platformStyle=PlatformTextStyle(includeFontPadding=false))
    val keyboard=when(m.effectiveInputMode) { "numeric"->KeyboardType.NumberPassword.takeIf { m.mask } ?: KeyboardType.Number; "tel"->KeyboardType.Phone; "email"->KeyboardType.Email; "url"->KeyboardType.Uri; "decimal"->KeyboardType.Decimal
        else->if(m.mask) KeyboardType.Password else KeyboardType.Text }

    @Composable fun cell(i:Int) {
        val (target,width)=border(i)
        var tfv by remember { mutableStateOf(TextFieldValue(chars[i])) }
        if(tfv.text!=chars[i] && tfv.composition==null) tfv=TextFieldValue(chars[i],TextRange(chars[i].length))
        // Recomposed with the pipeline's value: the input's buffer is reset to it, so a later identical edit is a new one.
        SideEffect { rt.handledRaw.remove(i) }
        LaunchedEffect(rt.selectAll) { if(rt.selectIndex==i && rt.focusedIndex==i) tfv=tfv.copy(selection=TextRange(0,tfv.text.length)) }
        val hover=remember { MutableInteractionSource() }
        LaunchedEffect(hover) { hover.interactions.collect { when(it) { is HoverInteraction.Enter->rt.hoverIndex=i; is HoverInteraction.Exit->if(rt.hoverIndex==i) rt.hoverIndex=null } } }
        val label=m.cellLabelTemplate.replace("{index}","${i+1}").replace("{length}","$count")
        Box(Modifier.size(cellW.dp,cellH.dp).hoverable(hover,!disabled)
            .border(width.dp,awcColor(tracks[i].hex(t),awcColor(target,Color.Gray)),RoundedCornerShape(shape.dp))
            .inspectAWCNode(inspection,"cell-$i","cell-$i"),contentAlignment=Alignment.Center) {
            BasicTextField(value=tfv,onValueChange={ v-> tfv=edited(i,v,tfv) },enabled=!disabled,readOnly=m.readOnly,singleLine=true,textStyle=style,
                cursorBrush=SolidColor(awcColor(if(disabled) disabledContent else if(hasError) errorColor else focusColor,Color.Black)),
                visualTransformation=if(m.mask) PasswordVisualTransformation() else VisualTransformation.None,
                keyboardOptions=KeyboardOptions(keyboardType=keyboard,autoCorrectEnabled=false),
                modifier=Modifier.width((cellW-6).dp).height(line.dp).focusRequester(rt.requester(i)).onFocusChanged { focusChanged(i,it.isFocused) }
                    .onPreviewKeyEvent { e-> if(e.type!=KeyEventType.KeyDown) false else {
                        val name=when(e.key) { Key.Backspace->"Backspace"; Key.Delete->"Delete"; Key.DirectionLeft->"ArrowLeft"; Key.DirectionRight->"ArrowRight"
                            Key.MoveHome->"Home"; Key.MoveEnd->"End"; Key.Enter,Key.NumPadEnter->"Enter"; Key.Tab->if(e.isShiftPressed) "Shift+Tab" else "Tab"; else->null }
                        if(name==null || e.isCtrlPressed || e.isMetaPressed) false else key(i,name) } }
                    .semantics { contentDescription=label;if(hasError) error(supportText.ifEmpty { validationMessage }) })
        }
    }

    val ltrRow:@Composable ()->Unit={
        // Codes read left to right in RTL locales too: the row is pinned LTR.
        CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
            Row(Modifier.inspectAWCNode(inspection,"cells","cells").semantics { contentDescription=m.label;isTraversalGroup=true },horizontalArrangement=Arrangement.spacedBy(gap.dp),verticalAlignment=Alignment.CenterVertically) {
                for(i in 0 until count) {
                    if(m.group>0 && i>0 && i%m.group==0) { val k=i/m.group-1
                        Box(Modifier.widthIn(min=sepW.dp).clearAndSetSemantics { }.inspectAWCNode(inspection,"separator-$k","separator-$k"),contentAlignment=Alignment.Center) {
                            // The separator slot fills the first gap; later gaps keep the built-in dot.
                            var slotted by remember { mutableStateOf(false) }
                            if(k==0 && slot!=null) {
                                if(slotted) slot("separator")
                                else androidx.compose.ui.layout.Layout(content={ slot("separator") },modifier=Modifier.size(0.dp)) { ms,_->
                                    val authored=ms.any { it.maxIntrinsicWidth(1000)>0 };if(authored!=slotted) slotted=authored;layout(0,0) {} }
                            }
                            if(!(k==0 && slotted)) Box(Modifier.size(dot.dp).background(awcColor(if(disabled) disabledBorder else outline,Color.Gray),CircleShape))
                        }
                    }
                    cell(i)
                }
            }
        }
    }
    CompositionLocalProvider(LocalClipboardManager provides clipboardManager,LocalClipboard provides clipboard) {
        Column(Modifier.width(IntrinsicSize.Max).inspectAWCNode(inspection,"md-otp-field","md-otp-field")) {
            ltrRow()
            if(supportText.isNotEmpty() || m.reserveSupportingSpace) {
                // The support row's line is the host's 16px strut (line-height normal: 19); the 12px text sits on its baseline.
                val strutAscent=kotlin.math.round(16*ROBOTO_ASCENT);val strut=strutAscent+kotlin.math.round(16*ROBOTO_DESCENT)
                val color=if(disabled) disabledContent else if(hasError) errorColor else supportColor
                Box(Modifier.padding(top=4.dp,start=4.dp,end=4.dp).height(strut.dp).fillMaxWidth()) {
                    // The measured box is the CSS line box (line-height normal: rounded ascent + rounded descent); the text is
                    // laid out on that line from its top.
                    val supLine=kotlin.math.round(supportFont*ROBOTO_ASCENT)+kotlin.math.round(supportFont*ROBOTO_DESCENT)
                    Box(Modifier.padding(top=(strutAscent-supportFont*ROBOTO_ASCENT).dp).height(supLine.dp).inspectAWCNode(inspection,"supporting-text","supporting-text",allowZeroSize=true)) {
                    BasicText(supportText.ifEmpty { "​" },Modifier.wrapContentHeight(Alignment.Top,unbounded=true)
                        .semantics { if(hasError && supportText.isNotEmpty()) liveRegion=LiveRegionMode.Assertive },
                        style=TextStyle(fontFamily=OTPRoboto,fontSize=supportFont.sp,textMotion=androidx.compose.ui.text.style.TextMotion.Animated,
                            // CSS line-height normal: the rounded ascent plus the rounded descent.
                            lineHeight=(kotlin.math.round(supportFont*ROBOTO_ASCENT)+kotlin.math.round(supportFont*ROBOTO_DESCENT)).sp,color=awcColor(color,Color.Gray),
                            lineHeightStyle=LineHeightStyle(LineHeightStyle.Alignment.Center,LineHeightStyle.Trim.None),platformStyle=PlatformTextStyle(includeFontPadding=false)),softWrap=false)
                    }
                }
            }
        }
    }
}
