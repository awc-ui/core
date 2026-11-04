package dev.awc.nativeui

import android.os.Build
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.PointerEventType
import androidx.compose.ui.input.pointer.PointerType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.pointer.isAltPressed
import androidx.compose.ui.input.pointer.isCtrlPressed
import androidx.compose.ui.input.pointer.isShiftPressed
import kotlinx.coroutines.launch
import androidx.compose.ui.unit.dp
import java.math.BigDecimal
import java.math.MathContext
import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.max

// md-number-field: the source composes md-text-field (the input, label, supporting row) with md-icon-button steppers (inline in
// the trailing slot, or tonal circles split around the field). Display / parse / key filter follow Intl.NumberFormat via ICU.

/** The five md-number-field hooks (`--md-number-field-*`, dp); the md-text-field hooks pass through to the inner field. */
@Immutable data class AWCNumberFieldAppearance(val width:Double?=null,val minWidth:Double?=null,val stepperIconSize:Double?=null,val stepperColor:String?=null,
                                               val splitStepperSize:Double?=null) {
    private fun l(v:Double?)=v?.takeIf { it.isFinite() && it>=0 }
    internal fun normalized()=AWCNumberFieldAppearance(l(width),l(minWidth),l(stepperIconSize),switchColorHex(stepperColor),l(splitStepperSize))
    fun merge(o:AWCNumberFieldAppearance)=AWCNumberFieldAppearance(o.width ?: width,o.minWidth ?: minWidth,o.stepperIconSize ?: stepperIconSize,
        o.stepperColor ?: stepperColor,o.splitStepperSize ?: splitStepperSize)
    companion object {
        fun fromValues(v:Map<String,AWCValue>):AWCNumberFieldAppearance { fun n(k:String)=(v[k] as? Number)?.toDouble()
            return AWCNumberFieldAppearance(n("width"),n("minWidth"),n("stepperIconSize"),(v["stepperColor"] as? String)?.ifEmpty { null },n("splitStepperSize")).normalized() }
    }
}
internal val LocalAWCNumberFieldAppearance=staticCompositionLocalOf { AWCNumberFieldAppearance() }
@Composable fun AWCNumberFieldAppearanceScope(appearance:AWCNumberFieldAppearance,content:@Composable ()->Unit)=
    CompositionLocalProvider(LocalAWCNumberFieldAppearance provides LocalAWCNumberFieldAppearance.current.merge(appearance.normalized()),content=content)

/** setFocus / select / stepUp / stepDown / getValidity / checkValidity / reportValidity / setCustomValidity. */
class AWCNumberFieldController {
    internal var runtime:NumberFieldRuntime?=null
    internal val field=AWCTextFieldController()
    val isConnected get()=runtime!=null
    fun setFocus():Boolean=field.setFocus()
    fun select()=field.select()
    fun stepUp(times:Double=1.0) { runtime?.step?.invoke(1.0,times) }
    fun stepDown(times:Double=1.0) { runtime?.step?.invoke(-1.0,times) }
    fun getValidity():AWCConstraintValidity=runtime?.validity?.invoke() ?: AWCConstraintValidity.VALID
    fun checkValidity():Boolean { val r=runtime ?: return true;return r.barred() || r.validity().valid }
    fun reportValidity():Boolean { val r=runtime ?: return true
        if(r.barred() || r.validity().valid) return true
        r.revealed=true;field.runtime?.focusLater();return false }
    fun setCustomValidity(message:String) { runtime?.customMessage=message }
    /** The raw value (null = empty) and the display text. */
    val value:Double? get()=runtime?.value
    val formattedValue:String get()=runtime?.inputValue ?: ""
    /** Test/host helper: drop focus from the field (the page focusing elsewhere). */
    fun runtimeBlur() { field.runtimeBlur() }
}
internal val LocalAWCNumberFieldController=staticCompositionLocalOf<AWCNumberFieldController?> { null }
@Composable fun AWCNumberFieldControllerScope(controller:AWCNumberFieldController,content:@Composable ()->Unit)=
    CompositionLocalProvider(LocalAWCNumberFieldController provides controller,content=content)

/** The source's `buildFormatInfo` / `parseNumber` / `hasOnlyAllowedChars` over ICU: separators, signs, percent, digits, symbols. */
internal object NumberFieldIntl {
    private val BIDI=Regex("[؜​‎‏‪-‮⁦-⁩]");private val SPACE=Regex("[\\s   ]")
    class Info(val group:String,val decimal:String,val minus:String,val plus:String,val percent:String,val symbolChars:String,
               val digitMap:Map<String,String>,val isPercent:Boolean,val allowed:Set<String>)
    private val cache=HashMap<String,Info>()
    fun options(json:String):Map<String,AWCValue>? { if(json.isBlank()) return null
        return runCatching { val o=org.json.JSONObject(json.trim());o.keys().asSequence().associateWith { k-> o.get(k).let { v-> if(v==org.json.JSONObject.NULL) null else v } } }.getOrNull() }
    fun format(v:Double?,locale:String,json:String):String { if(v==null) return ""
        return MeterNumberFormat.format(v,0.0,"",locale,options(json) ?: emptyMap<String,AWCValue>()) }
    fun info(locale:String,json:String):Info=cache.getOrPut("$locale|$json") { build(locale,options(json)) }
    private fun build(locale:String,opts:Map<String,AWCValue>?):Info {
        val ul=if(locale.isBlank()) android.icu.util.ULocale.getDefault() else android.icu.util.ULocale.forLanguageTag(locale)
        val s=android.icu.text.DecimalFormatSymbols.getInstance(ul)
        val api28=Build.VERSION.SDK_INT>=28
        val group=if(api28) s.groupingSeparatorString else s.groupingSeparator.toString()
        val decimal=if(api28) s.decimalSeparatorString else s.decimalSeparator.toString()
        val minus=if(api28) s.minusSignString else s.minusSign.toString()
        val plus=if(api28) s.plusSignString else s.plusSign.toString()
        val isPercent=opts?.get("style")=="percent"
        val percent=if(isPercent) (if(api28) s.percentString else s.percent.toString()) else ""
        val digits=s.digitStrings.toList()
        val digitMap=digits.mapIndexedNotNull { i,g-> if(g!=i.toString()) g to i.toString() else null }.toMap()
        // Currency / unit / literal characters of the active format: what remains of −12345678.9 after numerals and separators.
        val active=MeterNumberFormat.format(-12345678.9,0.0,"",locale,opts ?: emptyMap<String,AWCValue>())
        var rest=active
        for(t in digits+listOf("0","1","2","3","4","5","6","7","8","9",group,decimal,minus,plus,percent).filter { it.isNotEmpty() }) rest=rest.replace(t,"")
        val symbolChars=rest
        val allowed=HashSet<String>()
        for(d in 0..9) allowed.add(d.toString());allowed.addAll(digitMap.keys)
        for(cp in (group+decimal+minus+plus+symbolChars).codePoints().toArray()) allowed.add(String(Character.toChars(cp)))
        allowed.add("-");allowed.add("+")
        if(isPercent) { allowed.add("%");if(percent.isNotEmpty()) allowed.add(percent) }
        if(SPACE.containsMatchIn(group+symbolChars)) allowed.add(" ")
        return Info(group,decimal,minus,plus,percent,symbolChars,digitMap,isPercent,allowed)
    }
    fun parse(raw:String,locale:String,json:String):Double? {
        if(raw.isEmpty()) return null
        val i=info(locale,json);var s=BIDI.replace(raw,"")
        if(i.digitMap.isNotEmpty()) s=s.codePoints().toArray().joinToString("") { cp-> String(Character.toChars(cp)).let { i.digitMap[it] ?: it } }
        for(cp in i.symbolChars.codePoints().toArray().toSet()) s=s.replace(String(Character.toChars(cp)),"")
        s=SPACE.replace(s,"");if(i.percent.isNotEmpty()) s=s.replace(i.percent,"");s=s.replace("%","")
        if(i.group.isNotEmpty()) s=s.replace(i.group,"")
        if(i.decimal.isNotEmpty() && i.decimal!=".") s=s.replace(i.decimal,".")
        if(i.minus.isNotEmpty() && i.minus!="-") s=s.replace(i.minus,"-")
        if(i.plus.isNotEmpty() && i.plus!="+") s=s.replace(i.plus,"+")
        s=s.replace(Regex("[‒–−]"),"-")
        if(s=="" || s=="-" || s=="+") return null
        val n=jsNumber(s) ?: return null
        return if(i.isPercent) n/100 else n
    }
    /** ECMAScript `Number(s)` for decimal literals (no whitespace remains here). */
    private fun jsNumber(s:String):Double? { if(!Regex("[+-]?(\\d+\\.?\\d*|\\.\\d+)([eE][+-]?\\d+)?").matches(s)) return null
        return s.toDoubleOrNull()?.takeIf { it.isFinite() } }
    fun allowedText(raw:String,locale:String,json:String):Boolean { val i=info(locale,json)
        return BIDI.replace(raw,"").codePoints().toArray().all { cp-> val ch=String(Character.toChars(cp));ch in i.allowed || SPACE.matches(ch) } }
    fun allowedKey(ch:String,locale:String,json:String)=ch in info(locale,json).allowed
    fun fractionalFormat(json:String):Boolean { val fo=options(json) ?: return false
        fun n(k:String)=(fo[k] as? Number)?.toDouble() ?: 0.0
        return n("maximumFractionDigits")>0 || n("minimumFractionDigits")>0 || fo["style"]=="currency" || fo["style"]=="percent" }
    /** `toPrecision(15)` clean-up capped at 1e-10 (stepping only; typed values stay verbatim). */
    fun cleanFloat(n:Double):Double { if(!n.isFinite() || n==0.0) return n
        val p=BigDecimal(n).round(MathContext(15)).toDouble();return if(abs(p-n)<1e-10) p else n }
}

internal data class NumberFieldModel(val variant:String,val label:String,val placeholder:String,val supportingText:String,val errorText:String,val error:Boolean,
    val disabled:Boolean,val readOnly:Boolean,val required:Boolean,val reserveSupportingSpace:Boolean,val hidden:Boolean,val name:String,val density:Double?,
    val locale:String,val formatJSON:String,val min:Double?,val max:Double?,val step:Double,val smallStep:Double,val largeStep:Double,val snapOnStep:Boolean,
    val allowOutOfRange:Boolean,val allowWheelScrub:Boolean,val steppers:String,val incrementLabel:String,val decrementLabel:String,val valueMissingLabel:String,val ariaLabel:String) {
    val stepAmount get()=if(step.isFinite() && step>0) step else 1.0
    val inline get()=steppers=="inline"
    val split get()=steppers=="split"
    companion object {
        fun number(v:AWCValue?):Double?=when(v) { is Number->v.toDouble().takeIf { it.isFinite() }; is String->v.trim().takeIf { it.isNotEmpty() }?.toDoubleOrNull()?.takeIf { it.isFinite() }; else->null }
        fun of(p:Props):NumberFieldModel { fun s(k:String,d:String="")=(p[k] as? String) ?: d
            val fo=when(val v=p["formatOptions"]) { is String->v; is Map<*,*>->org.json.JSONObject(v).toString(); else->"" }
            return NumberFieldModel(if(s("variant")=="outlined") "outlined" else "filled",s("label"),s("placeholder"),s("supportingText"),s("errorText"),p.bool("error"),
                p.bool("disabled"),p.bool("readOnly") || p.bool("readonly"),p.bool("required"),p.bool("reserveSupportingSpace"),p.bool("hidden"),s("name"),
                number(p["density"])?.takeIf { it in setOf(0.0,-1.0,-2.0,-3.0,-4.0) },s("locale"),fo,number(p["min"]),number(p["max"]),number(p["step"]) ?: 1.0,
                number(p["smallStep"]) ?: 0.1,number(p["largeStep"]) ?: 10.0,p.bool("snapOnStep"),p.bool("allowOutOfRange"),p.bool("allowWheelScrub"),
                s("steppers","inline"),s("incrementLabel","Increment"),s("decrementLabel","Decrement"),s("valueMissingLabel","Please enter a number."),
                listOf(s("aria-label"),s("ariaLabel")).firstOrNull { it.isNotEmpty() } ?: "")
        }
    }
}

internal class NumberFieldRuntime {
    var inputValue by mutableStateOf("")
    var value by mutableStateOf<Double?>(null)
    var focused by mutableStateOf(false)
    var revealed by mutableStateOf(false)
    var customMessage by mutableStateOf("")
    var lastCommitted:Double?=null
    var defaultValue:Double?=null
    var lastProp:AWCValue?=null
    var started=false
    var lastValidityKey:String?=null
    var holdJob:kotlinx.coroutines.Job?=null
    var holdDir=1.0
    var step:((Double,Double)->Unit)?=null
    var validity:()->AWCConstraintValidity={ AWCConstraintValidity.VALID }
    var barred:()->Boolean={ false }
    fun endHold() { holdJob?.cancel();holdJob=null }
}

@Composable
internal fun NativeNumberField(p:Props,onEvent:EventSink,controlEvent:EventSink,slot:Slot?,formField:AWCFormField?,form:AWCFormState?) {
    val m=NumberFieldModel.of(p)
    if(m.hidden) return
    val rt=remember { NumberFieldRuntime() }
    val scope=rememberCoroutineScope()
    val appearance=LocalAWCNumberFieldAppearance.current
    val controller=LocalAWCNumberFieldController.current
    val fallbackField=remember { AWCTextFieldController() }
    val fieldController=controller?.field ?: fallbackField
    val actions=LocalAWCAction.current;val target=LocalAWCActionTarget.current
    val targetID=remember { java.util.UUID.randomUUID().toString() }
    val emitControl by rememberUpdatedState(controlEvent)
    val tokens=LocalAWCThemeTokens.current
    val scale=resolveAWCDensity(p["density"],LocalAWCNativeDensity.current)
    val inspection=LocalAWCInspection.current
    fun emit(name:String,detail:AWCValue) {
        dispatchNativeAction(AWCActionEvent(name,"md-number-field",(detail as? Map<*,*>)?.entries?.associate { it.key.toString() to it.value } ?: emptyMap(),cancelable=false,targetID=target?.id ?: targetID,rawDetail=detail),
            actions,target?.listeners?.invoke().orEmpty())
        emitControl(name,detail)
    }
    val disabled=m.disabled
    fun fmt(v:Double?)=NumberFieldIntl.format(v,m.locale,m.formatJSON)
    fun parse(raw:String)=NumberFieldIntl.parse(raw,m.locale,m.formatJSON)
    if(!rt.started) { rt.started=true;val v=NumberFieldModel.number(p["value"]);rt.value=v;rt.defaultValue=v;rt.lastCommitted=v;rt.lastProp=p["value"];rt.inputValue=fmt(v) }
    val validity=run { val custom=rt.customMessage
        if(custom.isNotEmpty()) AWCConstraintValidity.of("customError",custom)
        else if(m.required && rt.value==null) AWCConstraintValidity.of("valueMissing",m.errorText.ifEmpty { m.valueMissingLabel }) else AWCConstraintValidity.VALID }
    val validationMessage=if(rt.revealed && !validity.valid) validity.validationMessage else ""
    val inputMode=run { val fractional=m.stepAmount!=floor(m.stepAmount) || NumberFieldIntl.fractionalFormat(m.formatJSON)
        if(m.min!=null && m.min>=0 && !fractional) "numeric" else "decimal" }
    val stepperIcon=appearance.stepperIconSize ?: max(14.0,20+scale)
    val inlineStepper=max(20.0,28+scale*2);val splitStepper=appearance.splitStepperSize ?: max(32.0,40+scale*4);val fieldBox=max(40.0,56+scale*4)
    // Spacing tokens per density rung (md3.css section 12): inset-sm 8 → 4 from −3, gap-sm 8 → 4 from −3, gap-xs 4 → 2 at −4.
    val insetSm=if(scale<=-3) 4.0 else 8.0;val gapSm=if(scale<=-3) 4.0 else 8.0;val gapXs=if(scale<=-4) 2.0 else 4.0
    val stepperColor=appearance.stepperColor ?: switchColorHex(tokens["--md-sys-color-on-surface-variant"]) ?: "#49454F"

    // Live state for the methods and the form.
    rt.validity={ validity };rt.barred={ disabled || m.readOnly }
    SideEffect { controller?.runtime=rt;formField?.validityOverride={ val v=rt.validity();if(v.valid) null else v.validationMessage } }
    DisposableEffect(Unit) { onDispose { rt.endHold();if(controller?.runtime===rt) controller.runtime=null } }
    LaunchedEffect(validity.key) { val k=validity.key;if(rt.lastValidityKey!=null && rt.lastValidityKey!=k) emit("mdValidityChange",validity.eventValue);rt.lastValidityKey=k }
    LaunchedEffect(p["value"]) {
        val v=p["value"];if(v==rt.lastProp) return@LaunchedEffect
        rt.lastProp=v;val n=NumberFieldModel.number(v)
        if(n!=rt.value) { rt.value=n;rt.lastCommitted=n;val f=fmt(n);if(rt.inputValue!=f) rt.inputValue=f }   // a programmatic write is a committed fact
    }
    LaunchedEffect(m.locale,m.formatJSON) { rt.inputValue=fmt(rt.value) }
    LaunchedEffect(m.name) { rt.revealed=false }
    LaunchedEffect(p["_awcFormReset"]) { if(p["_awcFormReset"]!=null && p["_awcFormReset"]!=0) { rt.revealed=false;rt.customMessage="";rt.value=rt.defaultValue;rt.inputValue=fmt(rt.value);rt.lastCommitted=rt.value } }
    LaunchedEffect(formField?.error) { if(formField?.error!=null) rt.revealed=true }
    LaunchedEffect(disabled) { if(disabled) rt.revealed=false }

    fun clamp(x:Double):Double { var n=x;if(m.min!=null && n<m.min) n=m.min;if(m.max!=null && n>m.max) n=m.max;return n }
    fun snap(candidate:Double,amount:Double,dir:Double,nearest:Boolean):Double { val base=m.min ?: 0.0;val offset=candidate-base;val eps=amount*1e-10
        val units=if(nearest) Math.round(offset/amount).toDouble() else if(dir>0) floor(offset/amount+eps) else ceil(offset/amount-eps)
        return NumberFieldIntl.cleanFloat(base+units*amount) }
    fun atBound(dir:Double):Boolean { val v=rt.value ?: return false;return if(dir>0) m.max!=null && v>=m.max else m.min!=null && v<=m.min }
    fun detail(reason:String):AWCValue=mapOf("value" to rt.value,"formattedValue" to rt.inputValue,"reason" to reason)
    fun commit(next:Double?,reason:String) { val prev=rt.value;rt.value=next;rt.inputValue=fmt(next);val d=detail(reason)
        if(next!=prev) emit("mdInput",d);if(next!=rt.lastCommitted) { rt.lastCommitted=next;emit("mdChange",d) } }
    fun doStep(dir:Double,amount0:Double,nearest:Boolean,reason:String) { val amount=if(amount0.isFinite() && amount0>0) amount0 else m.stepAmount
        var next=(parse(rt.inputValue) ?: rt.value ?: 0.0)+dir*amount;if(m.snapOnStep) next=snap(next,amount,dir,nearest)
        commit(NumberFieldIntl.cleanFloat(clamp(next)),reason) }
    fun commitTyped(reason:String) { var next=parse(rt.inputValue);if(next!=null && !m.allowOutOfRange) next=clamp(next);commit(next,reason) }
    rt.step={ dir,times-> doStep(dir,m.stepAmount*max(1.0,times),false,"none") }
    fun holdTick() { val dir=rt.holdDir;if(atBound(dir)) { rt.endHold();return };doStep(dir,m.stepAmount,false,if(dir>0) "increment-press" else "decrement-press") }
    val stepperEnd:(Boolean)->Unit={ mouse-> rt.endHold();if(mouse) scope.launch { fieldController.setFocus() } }
    fun beginHold(dir:Double,mouse:Boolean) {
        if(disabled || m.readOnly) return
        if(mouse) fieldController.setFocus()   // mouse/pen keep the typing context in the input; a touch tap never summons the keyboard
        rt.endHold();rt.holdDir=dir;holdTick()
        rt.holdJob=scope.launch { kotlinx.coroutines.delay(400);while(true) { kotlinx.coroutines.delay(60);holdTick();if(rt.holdJob==null) break } }   // setTimeout(400) → setInterval(60): first repeat at 460 ms
    }
    fun fieldInput(raw:String) {
        if(raw.isBlank()) { rt.inputValue=raw;if(rt.value!=null) { rt.value=null;emit("mdInput",mapOf("value" to null,"formattedValue" to raw,"reason" to "input-clear")) };return }
        rt.inputValue=raw
        val parsed=parse(raw);if(parsed!=null && parsed!=rt.value) { rt.value=parsed;emit("mdInput",mapOf("value" to parsed,"formattedValue" to raw,"reason" to "input-change")) }
    }
    fun typedChar(old:String,new:String):String? { var i=0;while(i<old.length && old[i]==new[i]) i++
        if(i>=new.length || new.length!=old.length+1 || new.substring(i+1)!=old.substring(i)) return null;return new[i].toString() }
    val hooks=AWCFieldHooks(
        accept={ old,new-> if(new.isBlank()) true else { val ch=typedChar(old,new)
            if(ch!=null && !NumberFieldIntl.allowedKey(ch,m.locale,m.formatJSON)) false else NumberFieldIntl.allowedText(new,m.locale,m.formatJSON) } },
        key={ key-> if(disabled) false else { val parts=key.split("+");val name=parts.last();val shift="Shift" in parts;val alt="Alt" in parts
            when(name) {
                "ArrowUp","ArrowDown"->{ if(!m.readOnly) doStep(if(name=="ArrowUp") 1.0 else -1.0,if(shift) m.largeStep else if(alt) m.smallStep else m.stepAmount,alt,"keyboard");true }
                "Home"->if(m.min!=null && !m.readOnly && !shift && !alt) { commit(NumberFieldIntl.cleanFloat(clamp(m.min)),"keyboard");true } else false
                "End"->if(m.max!=null && !m.readOnly && !shift && !alt) { commit(NumberFieldIntl.cleanFloat(clamp(m.max)),"keyboard");true } else false
                "Enter"->{ commitTyped("input-blur");form?.submit();true }   // requestSubmit(): the default button is not clicked
                else->false } } },
        focus={ f-> rt.focused=f;if(!f) commitTyped("input-blur") },
        trailing=if(m.inline) { { Row(horizontalArrangement=Arrangement.spacedBy(gapXs.dp),verticalAlignment=Alignment.CenterVertically) {
            NumberStepper(-1.0,m,disabled,inlineStepper,stepperIcon,stepperColor,{ atBound(it) },::beginHold,stepperEnd,inspection)
            NumberStepper(1.0,m,disabled,inlineStepper,stepperIcon,stepperColor,{ atBound(it) },::beginHold,stepperEnd,inspection) } } } else null,
        controller=fieldController,
        event={ name,detail-> if(name=="mdInput") fieldInput(detail as? String ?: "") })
    val fieldProps:Props=buildMap {
        put("variant",m.variant);put("label",m.label);put("placeholder",m.placeholder);put("disabled",disabled);put("readOnly",m.readOnly);put("required",m.required)
        put("error",m.error || validationMessage.isNotEmpty());put("errorText",m.errorText.ifEmpty { validationMessage });put("supportingText",m.supportingText)
        put("reserveSupportingSpace",m.reserveSupportingSpace);put("inputMode",inputMode);put("autocomplete","off");put("spellcheck",false);put("value",rt.inputValue)
        if(m.density!=null) put("density",m.density);if(m.ariaLabel.isNotEmpty()) put("aria-label",m.ariaLabel)
    }
    // Wheel scrub (opt-in, focused only): a vertical delta steps; horizontal-only steps with Shift; Ctrl (pinch) is never taken.
    val wheel=rememberUpdatedState { delta:Float,shift:Boolean,alt:Boolean-> if(!m.allowWheelScrub || disabled || m.readOnly || !rt.focused) false
        else { doStep(if(delta>0) -1.0 else 1.0,if(shift) m.largeStep else if(alt) m.smallStep else m.stepAmount,alt,"wheel");true } }
    val inspector=LocalAWCNumberFieldInspector.current
    val focusedNow=rt.focused   // read in composition: a focus change recomposes the host
    SideEffect { inspector?.invoke(mapOf("md-number-field" to mapOf("value" to rt.value,"formattedValue" to rt.inputValue,"focused" to focusedNow,
        "validationMessage" to validationMessage,"valid" to validity.valid,"inputMode" to inputMode),
        "increment" to mapOf("disabled" to (disabled || m.readOnly || atBound(1.0))),"decrement" to mapOf("disabled" to (disabled || m.readOnly || atBound(-1.0))))) }
    val minW=appearance.minWidth ?: 200.0
    val hostMod=Modifier.let { if(appearance.width!=null) it.width(max(appearance.width,minW).dp) else it.fillMaxWidth().widthIn(min=minW.dp) }
        .inspectAWCNode(inspection,"md-number-field","md-number-field")
        .pointerInput(Unit) { awaitPointerEventScope { while(true) {
            val e=awaitPointerEvent();if(e.type!=PointerEventType.Scroll) continue
            val c=e.changes.firstOrNull() ?: continue;val d=c.scrollDelta;val km=e.keyboardModifiers
            if(km.isCtrlPressed) continue
            val delta=if(d.y!=0f) d.y else if(km.isShiftPressed) d.x else 0f
            if(delta==0f || !wheel.value(delta,km.isShiftPressed,km.isAltPressed)) continue
            c.consume()
        } } }
    val inner:@Composable ()->Unit={
        // :host(.md-number-field--inline) sets --md-text-field-padding-inline-end: 8px.
        val tfAppearance=if(m.inline && LocalAWCTextFieldAppearance.current.paddingInlineEnd==null) AWCTextFieldAppearance(paddingInlineEnd=insetSm) else AWCTextFieldAppearance()
        AWCTextFieldAppearanceScope(tfAppearance) { Box(Modifier.inspectAWCNode(inspection,"field","field")) { NativeTextField(fieldProps,{ _,_-> },{ _,_-> },null,null,null,hooks) } }
    }
    if(m.split) Row(hostMod,horizontalArrangement=Arrangement.spacedBy(gapSm.dp),verticalAlignment=Alignment.Top) {
        Box(Modifier.padding(top=((fieldBox-splitStepper)/2).dp)) { NumberStepper(-1.0,m,disabled,splitStepper,stepperIcon,stepperColor,{ atBound(it) },::beginHold,stepperEnd,inspection) }
        Box(Modifier.weight(1f)) { inner() }
        Box(Modifier.padding(top=((fieldBox-splitStepper)/2).dp)) { NumberStepper(1.0,m,disabled,splitStepper,stepperIcon,stepperColor,{ atBound(it) },::beginHold,stepperEnd,inspection) }
    } else Box(hostMod) { inner() }
}

internal val LocalAWCNumberFieldInspector=staticCompositionLocalOf<((Map<String,Map<String,Any?>>)->Unit)?> { null }
/** Opt-in values of the number field's own nodes (host state, stepper disabled states), keyed by part name. */
@Composable fun AWCNumberFieldInspectionScope(onField:(Map<String,Map<String,Any?>>)->Unit,content:@Composable ()->Unit)=
    CompositionLocalProvider(LocalAWCNumberFieldInspector provides onField,content=content)

@Composable private fun NumberStepper(dir:Double,m:NumberFieldModel,disabled:Boolean,size:Double,icon:Double,color:String,atBound:(Double)->Boolean,
                                       begin:(Double,Boolean)->Unit,end:(Boolean)->Unit,inspection:AWCInspectionContext?) {
    val kind=if(dir>0) "increment" else "decrement"
    val off=disabled || m.readOnly || atBound(dir)
    // The gesture outlives a hold that stops at the bound (the stepper turns disabled mid-press): its release still ends the
    // hold and hands focus back to the input, so the press reads the current state instead of restarting with it.
    val offNow by rememberUpdatedState(off);val beginNow by rememberUpdatedState(begin);val endNow by rememberUpdatedState(end)
    AWCIconButtonAppearanceScope(AWCIconButtonAppearance(iconColor=color,iconSize=icon,width=size,height=size)) {
        Box(Modifier.inspectAWCNode(inspection,kind,kind).pointerInput(dir) {
            awaitEachGesture {
                val down=awaitFirstDown(requireUnconsumed=false,pass=PointerEventPass.Initial)
                if(offNow) return@awaitEachGesture
                val mouse=down.type==PointerType.Mouse || down.type==PointerType.Stylus
                beginNow(dir,mouse)
                val w=this.size.width.toFloat();val h=this.size.height.toFloat()
                while(true) { val e=awaitPointerEvent(PointerEventPass.Initial);val c=e.changes.firstOrNull { it.id==down.id } ?: break
                    // pointerup, pointercancel and pointerleave end the hold.
                    if(!c.pressed || e.type==PointerEventType.Exit || c.position.x<0 || c.position.y<0 || c.position.x>w || c.position.y>h) break }
                endNow(mouse)
            }
        }) {
            // The steppers' click / mdClick stay inside the number field (the source stops their propagation).
            CompositionLocalProvider(LocalAWCAction provides null,LocalAWCActionTarget provides null) { AWCComponent("md-icon-button",mapOf("variant" to (if(m.inline) "standard" else "tonal"),"icon" to (if(dir>0) "add" else "remove"),
                "aria-label" to (if(dir>0) m.incrementLabel else m.decrementLabel),"disabled" to off,"groupTabindex" to -1),onEvent={ _,_-> }) }
        }
    }
}
