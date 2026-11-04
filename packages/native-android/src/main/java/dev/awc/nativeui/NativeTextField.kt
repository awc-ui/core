@file:OptIn(androidx.compose.ui.text.ExperimentalTextApi::class)
package dev.awc.nativeui

import android.os.Handler
import android.os.Looper
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.focusable
import androidx.compose.foundation.hoverable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsHoveredAsState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.RoundRect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathFillType
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.input.key.*
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.layout.layout
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.*
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.*
import androidx.compose.ui.text.style.LineHeightStyle
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

// ── Hooks ──────────────────────────────────────────────────────────────────────────────────────────────────────────

/** The 17 public md-text-field hooks (`--md-text-field-*`); lengths are dp (= CSS px), colours `#RRGGBB[AA]`. */
@Immutable data class AWCTextFieldAppearance(
    val activeIndicatorColor:String?=null,val containerColor:String?=null,val containerShape:Double?=null,val cursor:String?=null,
    val errorColor:String?=null,val filledPill:Double?=null,val focusBorderWidth:Double?=null,val focusInset:Double?=null,
    val iconColor:String?=null,val iconSize:Double?=null,val inputColor:String?=null,val labelColor:String?=null,val opticalNudge:Double?=null,
    val outlineColor:String?=null,val paddingInlineStart:Double?=null,val paddingInlineEnd:Double?=null,val supportingTextColor:String?=null,
) {
    private fun l(v:Double?)=v?.takeIf { it.isFinite() && it>=0 }
    private fun s(v:Double?)=v?.takeIf { it.isFinite() }
    internal fun normalized()=AWCTextFieldAppearance(switchColorHex(activeIndicatorColor),switchColorHex(containerColor),l(containerShape),
        cursor?.takeIf { it.matches(Regex("^[a-z-]+$")) },switchColorHex(errorColor),s(filledPill),l(focusBorderWidth),s(focusInset),
        switchColorHex(iconColor),l(iconSize),switchColorHex(inputColor),switchColorHex(labelColor),s(opticalNudge),switchColorHex(outlineColor),
        l(paddingInlineStart),l(paddingInlineEnd),switchColorHex(supportingTextColor))
    fun merge(o:AWCTextFieldAppearance)=AWCTextFieldAppearance(o.activeIndicatorColor ?: activeIndicatorColor,o.containerColor ?: containerColor,
        o.containerShape ?: containerShape,o.cursor ?: cursor,o.errorColor ?: errorColor,o.filledPill ?: filledPill,o.focusBorderWidth ?: focusBorderWidth,
        o.focusInset ?: focusInset,o.iconColor ?: iconColor,o.iconSize ?: iconSize,o.inputColor ?: inputColor,o.labelColor ?: labelColor,
        o.opticalNudge ?: opticalNudge,o.outlineColor ?: outlineColor,o.paddingInlineStart ?: paddingInlineStart,o.paddingInlineEnd ?: paddingInlineEnd,
        o.supportingTextColor ?: supportingTextColor)
    companion object {
        fun fromValues(v:Map<String,AWCValue>):AWCTextFieldAppearance {
            fun n(k:String)=(v[k] as? Number)?.toDouble()
            fun t(k:String)=(v[k] as? String)?.takeIf { it.isNotEmpty() }
            return AWCTextFieldAppearance(t("activeIndicatorColor"),t("containerColor"),n("containerShape"),t("cursor"),t("errorColor"),n("filledPill"),
                n("focusBorderWidth"),n("focusInset"),t("iconColor"),n("iconSize"),t("inputColor"),t("labelColor"),n("opticalNudge"),t("outlineColor"),
                n("paddingInlineStart"),n("paddingInlineEnd"),t("supportingTextColor")).normalized()
        }
    }
}
internal val LocalAWCTextFieldAppearance=staticCompositionLocalOf { AWCTextFieldAppearance() }
@Composable fun AWCTextFieldAppearanceScope(appearance:AWCTextFieldAppearance,content:@Composable ()->Unit)=
    CompositionLocalProvider(LocalAWCTextFieldAppearance provides LocalAWCTextFieldAppearance.current.merge(appearance.normalized()),content=content)
/**
 * Typed counterparts of md-text-field's `::part()` rules (container, label, input, supporting-text, counter). Part values come
 * from the outer tree, so they win over the hooks and every internal hover, focus, error and disabled rule, as `::part()`
 * declarations do. Colours are `#RRGGBB[AA]`. The chips part styles nothing of its own (chips are md-chip children).
 */
@Immutable data class AWCTextFieldPartAppearance(
    val containerColor:String?=null,val labelColor:String?=null,val inputColor:String?=null,val caretColor:String?=null,
    val supportingTextColor:String?=null,val counterColor:String?=null,
) {
    internal fun normalized()=AWCTextFieldPartAppearance(switchColorHex(containerColor),switchColorHex(labelColor),switchColorHex(inputColor),
        switchColorHex(caretColor),switchColorHex(supportingTextColor),switchColorHex(counterColor))
    fun merge(o:AWCTextFieldPartAppearance)=AWCTextFieldPartAppearance(o.containerColor ?: containerColor,o.labelColor ?: labelColor,o.inputColor ?: inputColor,
        o.caretColor ?: caretColor,o.supportingTextColor ?: supportingTextColor,o.counterColor ?: counterColor)
    companion object {
        fun fromValues(v:Map<String,AWCValue>):AWCTextFieldPartAppearance {
            fun t(k:String)=(v[k] as? String)?.takeIf { it.isNotEmpty() }
            return AWCTextFieldPartAppearance(t("containerColor"),t("labelColor"),t("inputColor"),t("caretColor"),t("supportingTextColor"),t("counterColor")).normalized()
        }
    }
}
internal val LocalAWCTextFieldPartAppearance=staticCompositionLocalOf { AWCTextFieldPartAppearance() }
@Composable fun AWCTextFieldPartAppearanceScope(parts:AWCTextFieldPartAppearance,content:@Composable ()->Unit)=
    CompositionLocalProvider(LocalAWCTextFieldPartAppearance provides LocalAWCTextFieldPartAppearance.current.merge(parts.normalized()),content=content)
internal val LocalAWCFieldReducedMotion=staticCompositionLocalOf<Boolean?> { null }
/** Forces reduced (or full) motion for the text-input family, overriding the system animator scale. */
@Composable fun AWCFieldReducedMotionScope(reduced:Boolean?,content:@Composable ()->Unit)=CompositionLocalProvider(LocalAWCFieldReducedMotion provides reduced,content=content)

/** The `formatter` / `parser` function props (closures cannot travel through the portable property map). */
class AWCTextFieldFormatting(val formatter:((String)->String)?=null,val parser:((String)->String)?=null)
internal val LocalAWCTextFieldFormatting=staticCompositionLocalOf<AWCTextFieldFormatting?> { null }
@Composable fun AWCTextFieldFormattingScope(formatting:AWCTextFieldFormatting,content:@Composable ()->Unit)=
    CompositionLocalProvider(LocalAWCTextFieldFormatting provides formatting,content=content)

// ── Methods ────────────────────────────────────────────────────────────────────────────────────────────────────────

data class AWCTextFieldInputInfo(val value:String,val selectionStart:Int,val selectionEnd:Int,val focused:Boolean,val composing:Boolean)
/** setFocus / select / getInputElement / getValidity / checkValidity / reportValidity / setCustomValidity. */
class AWCTextFieldController {
    internal var runtime:TextFieldRuntime?=null
    val isConnected get()=runtime!=null
    fun setFocus():Boolean { val r=runtime ?: return false;return r.focus() }
    fun select() { val r=runtime ?: return;r.focus();r.selectAll() }
    fun getInputElement():AWCTextFieldInputInfo? { val r=runtime ?: return null
        return AWCTextFieldInputInfo(r.value(),r.field.value.selection.min,r.field.value.selection.max,r.focused,r.field.value.composition!=null) }
    fun getValidity():AWCConstraintValidity=runtime?.evaluate?.invoke() ?: AWCConstraintValidity.VALID
    fun checkValidity():Boolean { val r=runtime ?: return true;return r.barred || r.evaluate().valid }
    fun reportValidity():Boolean { val r=runtime ?: return true
        if(r.barred || r.evaluate().valid) return true
        r.revealed=true;r.focusLater();return false }
    fun setCustomValidity(message:String) { runtime?.customMessage=message }
    /** Test/host helper: drop focus from the field (the page focusing elsewhere). */
    fun runtimeBlur() { runtime?.blur?.invoke() }
}
internal val LocalAWCTextFieldController=staticCompositionLocalOf<AWCTextFieldController?> { null }
@Composable fun AWCTextFieldControllerScope(controller:AWCTextFieldController,content:@Composable ()->Unit)=
    CompositionLocalProvider(LocalAWCTextFieldController provides controller,content=content)

// ── Constraint validation (Chrome's ValidityState + English messages) ─────────────────────────────────────────────

data class AWCConstraintValidity(val valid:Boolean,val validationMessage:String,val flags:Map<String,Boolean>) {
    /** getValidity(): every flag. */
    val value:Map<String,AWCValue> get()=mapOf("valid" to valid,"validationMessage" to validationMessage,"flags" to flags)
    /** mdValidityChange detail: only the raised flags. */
    val eventValue:Map<String,AWCValue> get()=mapOf("valid" to valid,"validationMessage" to validationMessage,"flags" to flags.filterValues { it })
    internal val key get()="$valid|$validationMessage"
    companion object {
        val FLAGS=listOf("valueMissing","typeMismatch","patternMismatch","tooLong","tooShort","rangeUnderflow","rangeOverflow","stepMismatch","badInput","customError")
        val VALID=of(null)
        internal fun of(flag:String?,message:String="")=AWCConstraintValidity(flag==null,if(flag==null) "" else message,FLAGS.associateWith { it==flag })
    }
}
internal class TextConstraints(val type:String,val required:Boolean,val pattern:String,val minLength:Int?,val maxLength:Int?,
                               val min:String?,val max:String?,val step:String?,val mutable:Boolean) {
    fun sanitize(v:String)=when(type) {
        "email","url" -> v.replace(Regex("[\r\n]"),"").trim { it==' ' || it=='\t' || it=='\n' || it=='\u000C' || it=='\r' }
        "number" -> if(number(v)!=null) v else ""
        else -> v.replace(Regex("[\r\n]"),"")
    }
    fun evaluate(raw:String,userEdited:Boolean,custom:String):AWCConstraintValidity {
        if(custom.isNotEmpty()) return AWCConstraintValidity.of("customError",custom)
        val value=sanitize(raw)
        if(type=="number" && raw.isNotEmpty() && value.isEmpty()) return AWCConstraintValidity.of("badInput","Please enter a number.")
        if(required && mutable && value.isEmpty()) return AWCConstraintValidity.of("valueMissing",if(type=="number") "Please enter a number." else "Please fill out this field.")
        if(value.isEmpty()) return AWCConstraintValidity.VALID
        if(type=="email") emailMismatch(value)?.let { return AWCConstraintValidity.of("typeMismatch",it) }
        if(type=="url" && !validUrl(value)) return AWCConstraintValidity.of("typeMismatch","Please enter a URL.")
        if(pattern.isNotEmpty() && type in setOf("text","search","url","tel","email","password")) {
            val re=runCatching { Regex("^(?:$pattern)$") }.getOrNull()
            if(re!=null && !re.matches(value)) return AWCConstraintValidity.of("patternMismatch","Please match the requested format.")
        }
        if(userEdited && type!="number") {
            val length=value.length
            val s=if(length==1) "" else "s"
            if(maxLength!=null && length>maxLength) return AWCConstraintValidity.of("tooLong","Please shorten this text to $maxLength characters or less (you are currently using $length character$s).")
            if(minLength!=null && length<minLength) return AWCConstraintValidity.of("tooShort","Please lengthen this text to $minLength characters or more (you are currently using $length character$s).")
        }
        if(type=="number") { val n=number(value) ?: return AWCConstraintValidity.VALID
            val lo=min?.let(::number);val hi=max?.let(::number)
            if(lo!=null && n<lo) return AWCConstraintValidity.of("rangeUnderflow","Value must be greater than or equal to ${fmt(lo)}.")
            if(hi!=null && n>hi) return AWCConstraintValidity.of("rangeOverflow","Value must be less than or equal to ${fmt(hi)}.")
            val st=if(step?.lowercase()=="any") null else (step?.let(::number)?.takeIf { it>0 } ?: 1.0)
            if(st!=null) { val base=lo ?: 0.0;val k=(n-base)/st
                if(abs(k-Math.rint(k))>1e-9*max(1.0,abs(k))) { val lower=base+Math.floor(k)*st;val upper=lower+st
                    return if(hi!=null && upper>hi) AWCConstraintValidity.of("stepMismatch","Please enter a valid value. The nearest valid value is ${fmt(lower)}.")
                    else AWCConstraintValidity.of("stepMismatch","Please enter a valid value. The two nearest valid values are ${fmt(lower)} and ${fmt(upper)}.") } }
        }
        return AWCConstraintValidity.VALID
    }
    companion object {
        fun number(s:String):Double?=if(Regex("^-?(?:[0-9]+(?:\\.[0-9]+)?|\\.[0-9]+)(?:[eE][-+]?[0-9]+)?$").matches(s)) s.toDoubleOrNull()?.takeIf { it.isFinite() } else null
        fun fmt(v:Double)=if(v==Math.rint(v) && abs(v)<1e15) v.toLong().toString() else v.toString()
        private const val LOCAL="abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.!#$%&'*+/=?^_`{|}~-"
        private const val DOMAIN="abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-."
        /** Chromium's EmailInputType::TypeMismatchText. */
        fun emailMismatch(v:String):String? {
            val ok=Regex("^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$")
            if(ok.matches(v)) return null
            val at=v.indexOf('@')
            if(at<0) return "Please include an '@' in the email address. '$v' is missing an '@'."
            if(at==0) return "Please enter a part followed by '@'. '$v' is incomplete."
            if(at==v.length-1) return "Please enter a part following '@'. '$v' is incomplete."
            val local=v.substring(0,at);val domain=v.substring(at+1)
            local.firstOrNull { it !in LOCAL }?.let { return "A part followed by '@' should not contain the symbol '$it'." }
            domain.firstOrNull { it !in DOMAIN }?.let { return "A part following '@' should not contain the symbol '$it'." }
            if(domain.startsWith(".") || domain.endsWith(".") || domain.contains("..")) return "'.' is used at a wrong position in '$domain'."
            return "Please enter an email address."
        }
        fun validUrl(v:String):Boolean { val c=v.indexOf(':');if(c<=0) return false
            val scheme=v.substring(0,c);if(!scheme[0].isLetter() || !scheme.all { it.isLetterOrDigit() || it in "+-." }) return false
            return !v.contains(' ') && runCatching { java.net.URI(v) }.isSuccess }
    }
}

// ── Source model ───────────────────────────────────────────────────────────────────────────────────────────────────

internal enum class FieldMode { Off, Internal, External;
    companion object { fun of(v:AWCValue?)=when(v) { true -> Internal; "internal" -> Internal; "external" -> External; else -> Off } } }
internal data class TextFieldModel(val variant:String,val label:String,val placeholder:String,val type:String,val name:String,val pattern:String,
    val minLength:Int?,val maxLength:Int?,val min:String?,val max:String?,val step:String?,val autocomplete:String,val inputMode:String,
    val enterKeyHint:String,val autoCapitalize:String,val spellcheck:Boolean,val disabled:Boolean,val readOnly:Boolean,val required:Boolean,val error:Boolean,
    val errorText:String,val supportingText:String,val prefixText:String,val suffixText:String,val clearable:FieldMode,val passwordToggle:FieldMode,
    val speechToText:FieldMode,val showPasswordLabel:String,val hidePasswordLabel:String,val density:Double?,val multiline:String,val rows:Int?,
    val restrict:String,val formatOn:String,val focusBorderWidth:Double,val appearFocused:Boolean,val chipsWrap:Boolean,val reserveSupportingSpace:Boolean,
    val debounce:Double,val throttle:Double,val inputRole:String,val inputExpanded:Boolean,val hidden:Boolean,val ariaLabel:String,
    val speechLang:String="",val inputAriaAutocomplete:String="") {
    val isMultiline get()=multiline.isNotEmpty()
    val effectiveRows get()=rows ?: if(multiline=="fixed") 4 else 2
    val showPasswordToggle get()=!isMultiline && passwordToggle!=FieldMode.Off
    val constraintsMutable get()=!disabled && !readOnly
    fun constraints()=TextConstraints(type,required,pattern,minLength,maxLength,min,max,step,constraintsMutable)
    fun applyRestrict(raw:String):String {
        if(restrict.isEmpty()) return raw
        val presets=mapOf("numeric" to "[^0-9]","integer" to "[^0-9-]","decimal" to "[^0-9.\\-]","alpha" to "[^a-zA-Z]","alphanumeric" to "[^a-zA-Z0-9]")
        val inner=if(restrict.length>=2 && restrict.startsWith("[") && restrict.endsWith("]")) restrict.substring(1,restrict.length-1) else restrict
        val re=runCatching { Regex(presets[restrict] ?: "[^$inner]") }.getOrNull() ?: return raw
        return raw.replace(re,"")
    }
    companion object {
        fun truncate(text:String,limit:Int):String { val out=StringBuilder();var i=0
            while(i<text.length) { val cp=text.codePointAt(i);val n=Character.charCount(cp);if(out.length+n>limit) break;out.appendCodePoint(cp);i+=n };return out.toString() }
        fun of(p:Props):TextFieldModel {
            fun s(k:String,f:String="")=(p[k] as? String) ?: f
            fun n(k:String)=(p[k] as? Number)?.toDouble()?.takeIf { it.isFinite() }
            fun raw(k:String)=when(val v=p[k]) { is String -> v.ifEmpty { null }; is Number -> v.toDouble().takeIf { it.isFinite() }?.let { TextConstraints.fmt(it) }; else -> null }
            val multiline=when(val v=p["multiline"]) { is String -> if(v in setOf("auto-grow","fixed")) v else if(v.isEmpty()) "" else "auto-grow"; true -> "auto-grow"; else -> "" }
            return TextFieldModel(if(s("variant","filled")=="outlined") "outlined" else "filled",s("label"),s("placeholder"),s("type","text").ifEmpty { "text" },s("name"),
                s("pattern"),n("minLength")?.takeIf { it>=0 }?.toInt(),n("maxLength")?.takeIf { it>=0 }?.toInt(),raw("min"),raw("max"),raw("step"),
                s("autocomplete"),s("inputMode"),s("enterKeyHint"),s("autoCapitalize"),p.bool("spellcheck",true),p.bool("disabled"),p.bool("readOnly") || p.bool("readonly"),
                p.bool("required"),p.bool("error"),s("errorText"),s("supportingText"),s("prefixText"),s("suffixText"),FieldMode.of(p["clearable"]),FieldMode.of(p["passwordToggle"]),
                FieldMode.of(p["speechToText"]),s("showPasswordLabel","Show password"),s("hidePasswordLabel","Hide password"),n("density"),multiline,n("rows")?.toInt(),
                s("restrict"),if(s("formatOn","blur")=="input") "input" else "blur",n("focusBorderWidth") ?: 3.0,p.bool("appearFocused"),p.bool("chipsWrap"),
                p.bool("reserveSupportingSpace"),n("debounce") ?: 0.0,n("throttle") ?: 0.0,if(s("inputRole")=="combobox") "combobox" else "",p.bool("inputExpanded"),
                p.bool("hidden"),listOf(s("aria-label"),s("ariaLabel")).firstOrNull { it.isNotEmpty() } ?: "",
                speechLang=s("speechLang"),inputAriaAutocomplete=s("inputAriaAutocomplete").takeIf { it in setOf("none","inline","list","both") } ?: "")
        }
    }
}

// ── mdSearch emission ──────────────────────────────────────────────────────────────────────────────────────────────

internal class SearchEmitter {
    /** The field's composition scope: its timers run on the frame clock's dispatcher (the test clock in instrumentation). */
    var scope:kotlinx.coroutines.CoroutineScope?=null
    private var last:String?=null;private var debounce:kotlinx.coroutines.Job?=null;private var throttle:kotlinx.coroutines.Job?=null;private var pending=false
    var send:(String)->Unit={};var current:()->String={ "" }
    private fun distinct(v:String) { if(v==last) return;last=v;send(v) }
    fun emit(v:String,debounceMs:Double,throttleMs:Double) {
        val sc=scope
        if(debounceMs>0) { debounce?.cancel();debounce=sc?.launch { kotlinx.coroutines.delay(debounceMs.toLong());distinct(v) };if(sc==null) distinct(v) }
        if(throttleMs>0) {
            if(throttle==null) { distinct(v);pending=false
                // Chrome runs input before a timer due at the same instant: the window closes 1 ms after its end.
                throttle=sc?.launch { kotlinx.coroutines.delay(throttleMs.toLong()+1);throttle=null;if(pending) { distinct(current());pending=false } }
            } else pending=true
        }
        if(debounceMs<=0 && throttleMs<=0) distinct(v)
    }
    fun cancel() { debounce?.cancel();throttle?.cancel();debounce=null;throttle=null;pending=false }
}

// ── Style (md-text-field.css, rule by rule) ────────────────────────────────────────────────────────────────────────

internal data class TextFieldStates(val focused:Boolean=false,val hover:Boolean=false,val floating:Boolean=false,val hasLeading:Boolean=false,
    val hasError:Boolean=false,val disabled:Boolean=false)
internal class TextFieldStyle(val m:TextFieldModel,val a:AWCTextFieldAppearance,val tokens:Map<String,String>,val scale:Double,val localRung:Double?,
    val parts:AWCTextFieldPartAppearance=AWCTextFieldPartAppearance()) {
    private fun tok(name:String,f:String)=switchColorHex(tokens["--md-sys-color-$name"]) ?: f
    private fun num(k:String,f:Double)=tokens[k]?.replace("px","")?.trim()?.toDoubleOrNull() ?: f
    val filled get()=m.variant=="filled"
    val insetLG get()=if(scale<=-4) 8.0 else if(scale<=-2) 12.0 else 16.0
    val gapLG get()=insetLG
    val padStart get()=a.paddingInlineStart ?: (insetLG+7)
    val padEnd get()=a.paddingInlineEnd ?: (insetLG+7)
    val iconSize get()=a.iconSize ?: max(18.0,24+scale)
    val minHeight get()=56+scale*4
    val padBlock get()=if(filled) max(2.0,8+scale*.5) else max(2.0,8+scale)
    val inputFont get()=max(13.0,16+scale*.5)
    val inputLine get()=if(filled) max(16.0,24+scale*2) else max(18.0,24+scale)
    val restFont get()=max(13.0,16+scale*.5)
    val restLine get()=max(18.0,24+scale)
    val affixLine get()=max(18.0,24+scale)
    val tracking get()=num("--md-sys-typescale-body-large-tracking",.5)
    val floatFont get()=if(filled) (if(localRung!=null) 11.0 else max(11.0,num("--md-sys-typescale-body-small-size",12.0)+scale*.25)) else max(10.0,12+scale*.5)
    val floatLine get()=if(filled && localRung!=null) 12.0 else if(filled) max(12.0,num("--md-sys-typescale-body-small-line-height",16.0)+scale) else max(12.0,16+scale)
    val floatTop get()=if(filled) (localRung?.let { if(it==-2.0) -2.0 else 1.0 } ?: 0.0) else if(localRung!=null && localRung<=-3) -4.0 else -8-scale
    val legendFont get()=max(10.0,12+scale*.5)
    val supportFont get()=max(10.0,12+scale*.5)
    val supportLine get()=max(14.0,16+scale*.5)
    val shape get()=a.containerShape ?: num("--md-sys-shape-corner-extra-small",4.0)
    val pill get()=a.filledPill ?: 0.0
    val bottomRadius get()=if(filled) max(0.0,pill*shape) else shape
    val focusBorder get()=if(m.focusBorderWidth!=3.0) max(0.0,m.focusBorderWidth) else (a.focusBorderWidth ?: 3.0)
    val focusInset get()=if(m.focusBorderWidth!=3.0) -(m.focusBorderWidth-1) else (a.focusInset ?: 0.0)
    val active get()=a.activeIndicatorColor ?: tok("primary","#6750A4")
    val errorColor get()=a.errorColor ?: tok("error","#B3261E")
    val onSurface get()=tok("on-surface","#1C1B1F")
    private val onErrorContainer get()=tok("on-error-container","#8C1D18")
    private val baseLabel get()=a.labelColor ?: tok("on-surface-variant","#49454F")
    private val baseSupport get()=a.supportingTextColor ?: tok("on-surface-variant","#49454F")
    private val baseIcon get()=a.iconColor ?: tok("on-surface-variant","#49454F")
    fun mix(hex:String,alpha:Double):String { val c=awcColor(hex,Color.Black);return "#%02X%02X%02X%02X".format((c.red*255).roundToInt(),(c.green*255).roundToInt(),(c.blue*255).roundToInt(),(c.alpha*alpha*255).roundToInt()) }
    private fun idle(s:TextFieldStates)=s.hover && !s.focused && !s.disabled
    fun container(s:TextFieldStates)=parts.containerColor ?: if(!filled) "#00000000" else if(s.disabled) mix(onSurface,.04) else a.containerColor ?: tok("surface-container-highest","#E6E0E9")
    fun input(s:TextFieldStates)=parts.inputColor ?: if(s.disabled) mix(onSurface,.38) else a.inputColor ?: onSurface
    val placeholder get()=baseLabel
    fun caret(s:TextFieldStates)=parts.caretColor ?: if(s.hasError) errorColor else active
    fun label(s:TextFieldStates)=parts.labelColor ?: when { s.disabled -> mix(onSurface,.38); idle(s) -> if(s.hasError) onErrorContainer else onSurface
        s.hasError -> errorColor; s.focused -> active; else -> baseLabel }
    fun indicator(s:TextFieldStates):Pair<Double,String> = when { s.disabled -> 1.0 to mix(onSurface,.38); idle(s) -> 1.0 to (if(s.hasError) onErrorContainer else onSurface)
        s.focused -> focusBorder to (if(s.hasError) errorColor else active); else -> 1.0 to (if(s.hasError) errorColor else tok("on-surface-variant","#49454F")) }
    val indicatorOpacity get()=(1-pill).coerceIn(0.0,1.0)
    data class Outline(val width:Double,val color:String,val inset:Double)
    fun outline(s:TextFieldStates)=when { s.disabled -> Outline(if(s.focused) focusBorder else 1.0,mix(onSurface,.12),if(s.focused) focusInset else 0.0)
        idle(s) -> Outline(1.0,if(s.hasError) onErrorContainer else onSurface,0.0); s.focused -> Outline(focusBorder,if(s.hasError) errorColor else active,focusInset)
        else -> Outline(1.0,if(s.hasError) errorColor else (a.outlineColor ?: tok("outline","#79747E")),0.0) }
    fun affix(s:TextFieldStates)=if(s.disabled) mix(onSurface,.38) else if(idle(s)) onSurface else baseSupport
    fun leadingIcon(s:TextFieldStates)=if(s.disabled) mix(onSurface,.38) else if(idle(s)) onSurface else baseIcon
    fun trailingIcon(s:TextFieldStates)=if(s.disabled) mix(onSurface,.38) else if(s.hasError) errorColor else if(idle(s)) onSurface else baseIcon
    fun action(s:TextFieldStates,disabled:Boolean,hovered:Boolean,listening:Boolean=false):Pair<String,Double> =
        if(disabled) onSurface to .38 else if(listening || s.hasError) errorColor to 1.0 else (if(hovered) onSurface else baseIcon) to 1.0
    fun support(s:TextFieldStates)=parts.supportingTextColor ?: if(s.disabled) mix(onSurface,.38) else if(s.hasError) errorColor else baseSupport
    fun counter(s:TextFieldStates)=parts.counterColor ?: if(s.disabled) mix(onSurface,.38) else baseSupport
    fun layer(s:TextFieldStates)=if(!filled || !s.hover || s.disabled) 0.0 else num("--md-sys-state-hover-state-layer-opacity",.08)
    val ring get()=tok("secondary","#625B71")
    fun ms(name:String,f:Double)=tokens["--md-sys-motion-duration-$name"]?.trim()?.let { if(it.endsWith("ms")) it.dropLast(2).toDoubleOrNull() else if(it.endsWith("s")) it.dropLast(1).toDoubleOrNull()?.times(1000) else null } ?: f
    fun ease(name:String,f:List<Double>)=accordionCubicBezierCurve(tokens["--md-sys-motion-easing-$name"]) ?: f
    val labelMotion get()=ms("medium1",250.0) to ease("emphasized",listOf(.2,0.0,0.0,1.0))
    val colorMotion get()=ms("short2",100.0) to listOf(.25,.1,.25,1.0)
    val layerMotion get()=ms("short2",100.0) to ease("standard",listOf(.2,0.0,0.0,1.0))
}

// ── CSS transitions on the frame clock ─────────────────────────────────────────────────────────────────────────────

/** One animatable property with CSS transition semantics (start from the current value; reversal shortening). */
internal class FieldTrack(initial:Double) {
    private var from=initial;var to=initial;private set;private var start=Double.NaN;private var duration=0.0;private var curve=listOf(0.0,0.0,1.0,1.0)
    private var reversingStart=initial;private var shortening=1.0
    /** A transition started from rest takes its start time from the frame whose composition set it: the first tick runs one
     *  frame later (`frame`, the display's frame interval), as Chrome starts a transition at the style change's frame. */
    fun tick(ft:Double,frame:Double=0.0) { if(start.isNaN() && duration>0) start=ft-frame }
    private fun progress(now:Double):Double { if(duration<=0) return 1.0;if(start.isNaN() || now.isNaN()) return 0.0
        return ((now-start)/duration).coerceIn(0.0,1.0).let { if(it<=0.0) 0.0 else if(it>=1.0) 1.0 else accordionCubicBezier(it,curve) } }
    fun value(now:Double)=from+(to-from)*progress(now)
    fun running(now:Double)=duration>0 && (start.isNaN() || now<start+duration)
    fun snap(v:Double) { from=v;to=v;duration=0.0;reversingStart=v;shortening=1.0 }
    fun set(target:Double,now:Double,dur:Double,c:List<Double>) {
        if(target==to) return
        val cur=value(now);val wasRunning=running(now)
        if(dur<=0 || cur==target) { snap(target);return }
        if(wasRunning && reversingStart==target) { val f=abs(progress(now)*shortening+1-shortening).coerceIn(0.0,1.0)
            reversingStart=to;from=cur;to=target;start=now;duration=dur*f;curve=c;shortening=f
        } else { reversingStart=cur;from=cur;to=target;start=if(wasRunning) now else Double.NaN;duration=dur;curve=c;shortening=1.0 }   // from idle: the next frame starts it
    }
}
/** Colour channels on premultiplied sRGB, as Chrome interpolates legacy colours. */
internal class FieldColorTrack(hex:String) {
    private val r=FieldTrack(0.0);private val g=FieldTrack(0.0);private val b=FieldTrack(0.0);private val al=FieldTrack(0.0);var target=hex;private set
    init { snap(hex) }
    private fun ch(hex:String) = awcColor(hex,Color.Transparent).let { listOf(it.red*it.alpha,it.green*it.alpha,it.blue*it.alpha,it.alpha).map(Float::toDouble) }
    fun snap(hex:String) { target=hex;val c=ch(hex);r.snap(c[0]);g.snap(c[1]);b.snap(c[2]);al.snap(c[3]) }
    fun set(hex:String,now:Double,dur:Double,curve:List<Double>) { if(hex==target) return;target=hex;val c=ch(hex)
        r.set(c[0],now,dur,curve);g.set(c[1],now,dur,curve);b.set(c[2],now,dur,curve);al.set(c[3],now,dur,curve) }
    fun running(now:Double)=r.running(now) || g.running(now) || b.running(now) || al.running(now)
    fun tick(ft:Double,frame:Double=0.0) { r.tick(ft,frame);g.tick(ft,frame);b.tick(ft,frame);al.tick(ft,frame) }
    fun value(now:Double):Color { val a=al.value(now).coerceIn(0.0,1.0);if(a<=0) return Color.Transparent
        return Color((r.value(now)/a).toFloat().coerceIn(0f,1f),(g.value(now)/a).toFloat().coerceIn(0f,1f),(b.value(now)/a).toFloat().coerceIn(0f,1f),a.toFloat()) }
    fun hex(now:Double):String { val c=value(now);return "#%02X%02X%02X%02X".format((c.red*255).roundToInt(),(c.green*255).roundToInt(),(c.blue*255).roundToInt(),(c.alpha*255).roundToInt()) }
}

// ── Runtime ────────────────────────────────────────────────────────────────────────────────────────────────────────

internal class TextFieldRuntime {
    val focusRequester=FocusRequester()
    /** The internal speech-to-text session (speech-to-text="internal"), while listening. */
    var speech:android.speech.SpeechRecognizer?=null
    var field=mutableStateOf(TextFieldValue(""))
    var focused by mutableStateOf(false)
    var revealed by mutableStateOf(false)
    var customMessage by mutableStateOf("")
    var userEdited by mutableStateOf(false)
    var passwordVisible by mutableStateOf(false)
    var listening by mutableStateOf(false)
    var multilineHeight by mutableStateOf(0.0)
    var baseline=""
    var lastValue:String?=null
    var lastValidityKey:String?=null
    var validityNow=AWCConstraintValidity.VALID
    /** Validity of the live value (an event handler reads it before the next composition: the form refreshes its errors on mdInput). */
    var evaluate:()->AWCConstraintValidity={ validityNow }
    var barred=false
    val search=SearchEmitter()
    var value:()->String={ lastValue ?: "" }
    var selectAllRequested=false
    var blur:()->Unit={}
    fun focus():Boolean=runCatching { focusRequester.requestFocus();true }.getOrDefault(false)
    fun focusLater() { Handler(Looper.getMainLooper()).post { focus() } }
    fun selectAll() { selectAllRequested=true;val v=field.value;field.value=v.copy(selection=TextRange(0,v.text.length)) }
}

private val FieldRoboto=FontFamily(Font(R.font.awc_roboto_regular,FontWeight.Normal),Font(R.font.awc_roboto_medium,FontWeight.Medium))
private const val ROBOTO_EM=(1900.0+500.0)/2048.0

// ── Renderer ───────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Hooks a composite built on the text field uses (md-number-field, md-otp-field, md-search): the source composes an
 * md-text-field and listens to its input, keydown, focus and blur events inside its own shadow root.
 */
internal class AWCFieldHooks(
    /** A user edit before any event (previous text, new text): false keeps the previous text and fires nothing. */
    val accept:((String,String)->Boolean)?=null,
    /** Keys in the input before the field's own handling ("ArrowUp", "Shift+ArrowDown", "Alt+ArrowUp", "Home", "End", "Enter"…). */
    val key:((String)->Boolean)?=null,
    /** The input gained or lost focus (after the field's own focus handling). */
    val focus:((Boolean)->Unit)?=null,
    /** Replaces the trailing-icon slot (composite-owned buttons such as the inline steppers). */
    val trailing:(@Composable ()->Unit)?=null,
    /** The composite's controller for the inner input (an embedded field attaches to no other controller). */
    val controller:AWCTextFieldController?=null,
    /** The inner field's events stay inside the composite (they never reach app listeners). */
    val event:((String,AWCValue)->Unit)?=null,
    /** Backspace / Delete / ArrowLeft / ArrowRight reach [key] before the text system (unhandled keys keep their own editing):
     *  md-autocomplete / md-multi-select remove the last chip on Backspace in an empty input. */
    val editingKeys:Boolean=false,
    /** Space and printable characters typed into a read-only input reach [key] (the character, " " for Space): Chrome still
     *  dispatches keydown in a readonly input (md-select / md-multi-select open on Space). */
    val readOnlyKeys:Boolean=false,
)

@Composable
internal fun NativeTextField(p:Props,onEvent:EventSink,controlEvent:EventSink,slot:Slot?,formField:AWCFormField?,form:AWCFormState?,hooks:AWCFieldHooks?=null) {
    val m=TextFieldModel.of(p)
    if(m.hidden) return
    var value by awcState(listOf(p["value"],p["_awcFormReset"])) { (p["value"] as? String ?: p["value"]?.toString() ?: "").let { if(m.isMultiline) it else it.replace(Regex("[\r\n]+"),"") } }
    val rt=remember { TextFieldRuntime() }
    val tokens=LocalAWCThemeTokens.current
    val appearance=LocalAWCTextFieldAppearance.current
    val localRung=m.density?.takeIf { it in listOf(-1.0,-2.0,-3.0,-4.0) }
    val scale=resolveAWCDensity(p["density"],LocalAWCNativeDensity.current)
    val st=TextFieldStyle(m,appearance,tokens,scale,localRung,LocalAWCTextFieldPartAppearance.current)
    val reduced=LocalAWCFieldReducedMotion.current ?: !android.animation.ValueAnimator.areAnimatorsEnabled()
    val formatting=LocalAWCTextFieldFormatting.current
    val controller=LocalAWCTextFieldController.current
    val inspection=LocalAWCInspection.current
    val values=remember { mutableMapOf<String,Map<String,Any?>>() }
    val inspector=LocalAWCTextFieldInspector.current
    val actions=LocalAWCAction.current;val target=LocalAWCActionTarget.current
    val targetID=remember { java.util.UUID.randomUUID().toString() }
    val emitControl by rememberUpdatedState(controlEvent)
    val rtl=LocalLayoutDirection.current==LayoutDirection.Rtl
    val focusManager=LocalFocusManager.current
    val context=androidx.compose.ui.platform.LocalContext.current
    fun emit(name:String,detail:AWCValue) {
        if(hooks!=null) { hooks.event?.invoke(name,detail);return }
        dispatchNativeAction(AWCActionEvent(name,"md-text-field",(detail as? Map<*,*>)?.entries?.associate { it.key.toString() to it.value } ?: emptyMap(),cancelable=false,targetID=target?.id ?: targetID,rawDetail=detail),
            actions,target?.listeners?.invoke().orEmpty())
        emitControl(name,detail)
    }
    val effectiveFormatOn=if(m.formatOn=="input" && formatting?.formatter!=null && formatting.parser==null) "blur" else m.formatOn
    val disabled=m.disabled
    val constraints=m.constraints()
    val validity=constraints.evaluate(value,rt.userEdited,rt.customMessage)
    val validationMessage=if(rt.revealed && !validity.valid) validity.validationMessage else ""
    val hasError=m.error || validationMessage.isNotEmpty()
    val supportMessage=if(hasError) m.errorText.ifEmpty { validationMessage.ifEmpty { m.supportingText } } else m.supportingText
    // Slot presence (slotchange): authored content has an intrinsic width.
    var hasLeading by remember { mutableStateOf(false) };var hasTrailing by remember { mutableStateOf(false) };var hasChips by remember { mutableStateOf(false) }
    val floating=rt.focused || m.appearFocused || value.isNotEmpty() || m.placeholder.isNotEmpty() || hasChips
    val hoverSource=remember { MutableInteractionSource() };val hovered by hoverSource.collectIsHoveredAsState()
    val states=TextFieldStates(rt.focused || m.appearFocused,hovered && !disabled,floating,hasLeading,hasError,disabled)
    fun display(v:String)=formatting?.formatter?.let { f-> if(rt.focused && effectiveFormatOn=="blur") v else runCatching { f(v) }.getOrDefault(v) } ?: v
    val counter=m.maxLength?.let { max-> val usesF=formatting?.formatter!=null && effectiveFormatOn=="input"
        "${if(usesF) value.replace(Regex("[-/\\s]"),"").length else value.length}/$max" } ?: ""
    val secure=m.type=="password" && !(m.passwordToggle==FieldMode.Internal && rt.passwordVisible)
    val revealedPw=if(m.passwordToggle==FieldMode.Internal) rt.passwordVisible else m.type!="password"
    val clearDisabled=disabled || m.readOnly || value.isEmpty()

    // Live state for the methods and the form.
    rt.validityNow=validity;rt.barred=disabled || m.readOnly
    rt.evaluate={ constraints.evaluate(rt.lastValue ?: value,rt.userEdited,rt.customMessage) }
    rt.value={ rt.lastValue ?: value }
    val searchScope=rememberCoroutineScope()
    rt.search.send={ emit("mdSearch",it) };rt.search.current={ rt.lastValue ?: "" };rt.search.scope=searchScope
    rt.blur={ focusManager.clearFocus(force=true) }
    SideEffect { (if(hooks!=null) hooks.controller else controller)?.runtime=rt;formField?.validityOverride={ val v=rt.evaluate();if(v.valid) null else v.validationMessage } }
    DisposableEffect(Unit) { onDispose { rt.search.cancel();rt.speech?.destroy();rt.speech=null;if(controller?.runtime===rt) controller.runtime=null } }
    LaunchedEffect(validity.key) { val k=validity.key;if(rt.lastValidityKey!=null && rt.lastValidityKey!=k) emit("mdValidityChange",validity.eventValue);rt.lastValidityKey=k }
    LaunchedEffect(value) {
        if(rt.lastValue!=value) { rt.baseline=value;if(!rt.focused) rt.userEdited=false }
        rt.lastValue=value
        val shown=if(rt.focused && formatting?.formatter!=null && effectiveFormatOn=="blur") value else display(value)
        if(rt.field.value.text!=shown && rt.field.value.composition==null) rt.field.value=TextFieldValue(shown,TextRange(shown.length))
    }
    LaunchedEffect(m.name) { rt.revealed=false }
    LaunchedEffect(p["_awcFormReset"]) { rt.revealed=false;rt.userEdited=false }
    LaunchedEffect(formField?.error) { if(formField?.error!=null) rt.revealed=true }
    LaunchedEffect(disabled) { if(disabled) rt.revealed=false }

    fun commitChange() { if(value!=rt.baseline) { rt.baseline=value;emit("mdChange",value) } }
    fun setValue(v:String) { rt.lastValue=v;value=v }
    fun clearValue() { rt.baseline="";setValue("");rt.field.value=TextFieldValue("")
        emit("mdInput","");emit("mdChange","");rt.search.emit("",m.debounce,m.throttle) }
    // speech-to-text="internal": android.speech.SpeechRecognizer with the source's flow (interim results; one utterance; the end
    // writes base + final, emits mdInput, mdChange and the final mdSpeechResult — also after an error, as the Web end event does).
    // Unavailable recognition logs a warning and does nothing, as the source does without the SpeechRecognition API. The host
    // app declares and requests RECORD_AUDIO; without it the recognizer reports an error and listening ends.
    fun toggleSpeech() {
        rt.speech?.let { it.stopListening();return }
        if(!android.speech.SpeechRecognizer.isRecognitionAvailable(context)) { android.util.Log.w("AWC","md-text-field: speech recognition is not available on this device.");return }
        val rec=android.speech.SpeechRecognizer.createSpeechRecognizer(context)
        val base=value;var final="";val sep=if(base.isNotEmpty() && !base.endsWith(" ")) " " else ""
        fun write(v:String) { setValue(v);rt.field.value=TextFieldValue(v,TextRange(v.length)) }
        fun end() { if(rt.speech!==rec) return
            rt.speech=null;rt.listening=false;rec.destroy();write(base+sep+final)
            emit("mdInput",value);rt.baseline=value;emit("mdChange",value);emit("mdSpeechResult",mapOf("transcript" to final,"listening" to false)) }
        rec.setRecognitionListener(object:android.speech.RecognitionListener {
            override fun onPartialResults(b:android.os.Bundle?) { val t=b?.getStringArrayList(android.speech.SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull() ?: return
                if(rt.speech!==rec) return;write(base+sep+final+t);emit("mdInput",value);emit("mdSpeechResult",mapOf("transcript" to final+t,"listening" to true)) }
            override fun onResults(b:android.os.Bundle?) { final+=b?.getStringArrayList(android.speech.SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull() ?: "";end() }
            override fun onError(error:Int) { if(error!=android.speech.SpeechRecognizer.ERROR_CLIENT) android.util.Log.w("AWC","md-text-field: speech recognition error $error");end() }
            override fun onReadyForSpeech(p:android.os.Bundle?) {}
            override fun onBeginningOfSpeech() {}
            override fun onRmsChanged(v:Float) {}
            override fun onBufferReceived(b:ByteArray?) {}
            override fun onEndOfSpeech() {}
            override fun onEvent(t:Int,p:android.os.Bundle?) {}
        })
        rt.speech=rec;rt.listening=true
        rec.startListening(android.content.Intent(android.speech.RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
            .putExtra(android.speech.RecognizerIntent.EXTRA_LANGUAGE_MODEL,android.speech.RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            .putExtra(android.speech.RecognizerIntent.EXTRA_PARTIAL_RESULTS,true).apply { if(m.speechLang.isNotEmpty()) putExtra(android.speech.RecognizerIntent.EXTRA_LANGUAGE,m.speechLang) })
    }
    fun edited(next:TextFieldValue) {
        val prev=rt.field.value
        if(next.composition!=null) { rt.field.value=next;return }
        if(next.text==prev.text) { rt.field.value=next;return }
        if(hooks?.accept!=null && !hooks.accept.invoke(prev.text,next.text)) { rt.field.value=prev;return }
        var text=next.text;var caret=next.selection.end;var shaped=false
        var restricted=m.applyRestrict(text)
        if(m.restrict.isNotEmpty() && m.maxLength!=null && restricted.length>m.maxLength) restricted=TextFieldModel.truncate(restricted,m.maxLength)
        if(restricted!=text) { val before=m.applyRestrict(text.substring(0,min(caret,text.length)));text=restricted;caret=min(before.length,text.length);shaped=true }
        else if(m.restrict.isEmpty() && !(formatting?.formatter!=null && effectiveFormatOn=="input") && m.maxLength!=null && text.length>m.maxLength) {
            rt.field.value=prev.copy(selection=prev.selection);return    // the input's maxlength refuses the insertion: no input event
        }
        if(!m.isMultiline) text=text.replace(Regex("[\r\n]+"),"")
        var newValue=formatting?.parser?.let { runCatching { it(text) }.getOrDefault(text) } ?: text
        val f=formatting?.formatter
        if(f!=null && effectiveFormatOn=="input") {
            m.maxLength?.let { max-> val content=newValue.replace(Regex("[-/\\s]"),"");if(content.length>max) newValue=TextFieldModel.truncate(content,max) }
            val formatted=runCatching { f(newValue) }.getOrDefault(newValue)
            fun cl(s:String)=formatting.parser?.let { it(s).length } ?: s.count { it.isLetterOrDigit() }
            val before=cl(text.substring(0,min(caret,text.length)))
            var pos=if(before==0) 0 else formatted.length
            if(before>0) for(i in formatted.indices) if(cl(formatted.substring(0,i+1))==before) { pos=i+1;break }
            rt.field.value=TextFieldValue(formatted,TextRange(pos))
        } else rt.field.value=if(shaped) TextFieldValue(text,TextRange(caret)) else next.copy(text=text)
        rt.userEdited=true
        setValue(newValue)
        emit("mdInput",newValue)
        rt.search.emit(newValue,m.debounce,m.throttle)
    }
    fun focusChanged(f:Boolean) {
        if(f==rt.focused) return
        rt.focused=f
        if(f) { rt.baseline=value;if(formatting?.formatter!=null && effectiveFormatOn=="blur") rt.field.value=TextFieldValue(value,TextRange(value.length)) }
        else { commitChange();val d=display(value);if(rt.field.value.text!=d) rt.field.value=TextFieldValue(d,TextRange(d.length)) }
        hooks?.focus?.invoke(f)
    }
    fun command(key:String):Boolean = if(hooks?.key?.invoke(key)==true) true else when(key) {
        "Escape" -> if(rt.field.value.composition==null && m.clearable==FieldMode.Internal && value.isNotEmpty() && !m.readOnly && !disabled) { clearValue();emit("mdClear",null);true } else false
        "Enter" -> if(rt.field.value.composition==null && !m.isMultiline) { commitChange();if(!disabled) form?.requestSubmit();true } else false
        else -> false
    }

    // Motion targets (focused rules declare `transition: height` only: indicator colour snaps on focus, eases on blur).
    val frame=remember { mutableDoubleStateOf(-1.0) }
    val labelT=remember { FieldTrack(if(floating) 1.0 else 0.0) };val legendT=remember { FieldTrack(if(floating && m.label.isNotEmpty()) 1.0 else 0.0) }
    val indH=remember { FieldTrack(st.indicator(states).first) };val layerT=remember { FieldTrack(st.layer(states)) }
    val labelC=remember { FieldColorTrack(st.label(states)) };val indC=remember { FieldColorTrack(st.indicator(states).second) }
    val outC=remember { FieldColorTrack(st.outline(states).color) };val contC=remember { FieldColorTrack(st.container(states)) }
    val now=frame.doubleValue.let { if(it<0) Double.NaN else it }
    val lm=st.labelMotion;val cm=st.colorMotion;val ly=st.layerMotion
    fun d(x:Double)=if(reduced) 0.0 else x
    labelT.set(if(floating) 1.0 else 0.0,now,d(lm.first),lm.second);legendT.set(if(floating && m.label.isNotEmpty()) 1.0 else 0.0,now,d(lm.first),lm.second)
    val ind=st.indicator(states)
    indH.set(ind.first,now,d(cm.first),cm.second);indC.set(ind.second,now,if(states.focused) 0.0 else d(cm.first),cm.second)
    labelC.set(st.label(states),now,d(cm.first),cm.second);outC.set(st.outline(states).color,now,if(states.focused) 0.0 else d(lm.first),lm.second)
    contC.set(st.container(states),now,d(lm.first),lm.second);layerT.set(st.layer(states),now,d(ly.first),ly.second)
    val anyRunning=labelT.running(now) || legendT.running(now) || indH.running(now) || layerT.running(now) || labelC.running(now) || indC.running(now) || outC.running(now) || contC.running(now)
    // The frame clock drives every transition (the test clock in instrumentation, Choreographer otherwise).
    val frameMs=1000.0/(androidx.compose.ui.platform.LocalView.current.display?.refreshRate?.takeIf { it>0f } ?: 60f)
    // The ticker starts in the apply of the composition that set a target (undispatched): its first frame is the next one, so a
    // transition starts at the composing frame. A LaunchedEffect body is dispatched and can first await a frame later (blur).
    val tickScope=rememberCoroutineScope();val ticker=remember { arrayOfNulls<kotlinx.coroutines.Job>(1) }
    // The tick runs inside the frame callback: its state write is applied before this frame's recomposition (a write after the
    // resumed continuation would only reach the next frame's composition, one frame behind Chrome).
    SideEffect { if(anyRunning && ticker[0]?.isActive!=true) ticker[0]=tickScope.launch(start=kotlinx.coroutines.CoroutineStart.UNDISPATCHED) { while(isActive) {
        val more=androidx.compose.runtime.withFrameMillis { ms-> val ft=ms.toDouble()
            labelT.tick(ft,frameMs);legendT.tick(ft,frameMs);indH.tick(ft,frameMs);layerT.tick(ft,frameMs);labelC.tick(ft,frameMs);indC.tick(ft,frameMs);outC.tick(ft,frameMs);contC.tick(ft,frameMs);frame.doubleValue=ft
            labelT.running(ft) || legendT.running(ft) || indH.running(ft) || layerT.running(ft) || labelC.running(ft) || indC.running(ft) || outC.running(ft) || contC.running(ft) }
        if(!more) break } } }
    val t=frame.doubleValue.let { if(it<0) 0.0 else it }
    val prog=labelT.value(t);val legendP=legendT.value(t)

    val density=LocalDensity.current
    val measurer=rememberTextMeasurer()
    val inputStyle=TextStyle(fontFamily=FieldRoboto,fontWeight=FontWeight.Normal,fontSize=st.inputFont.sp,lineHeight=st.inputLine.sp,letterSpacing=st.tracking.sp,
        color=awcColor(st.input(states),Color.Black),lineHeightStyle=LineHeightStyle(LineHeightStyle.Alignment.Center,LineHeightStyle.Trim.None),
        platformStyle=PlatformTextStyle(includeFontPadding=false))
    val multi=m.isMultiline;val fixedMulti=m.multiline=="fixed"
    val chipsH=if(hasChips) 32.0 else 0.0
    val affixOn=floating && (m.prefixText.isNotEmpty() || m.suffixText.isNotEmpty())
    val rowH=max(st.inputLine,max(chipsH,if(affixOn) st.affixLine else 0.0))
    val chipPad=if(st.filled && floating && hasChips && m.label.isNotEmpty()) max(12.0,16+scale) else 0.0
    val inputH=if(multi) (if(fixedMulti) m.effectiveRows*st.inputLine else max(m.effectiveRows*st.inputLine,rt.multilineHeight)) else st.inputLine
    val wrapContent=if(multi) (if(st.filled) 20.0 else 0.0)+inputH else rowH+chipPad
    val containerH=if(multi) st.padBlock*2+wrapContent else max(st.minHeight,st.padBlock*2+max(wrapContent,st.iconSize))
    val wrapH=if(multi) wrapContent else containerH-st.padBlock*2
    val rowTop=if(multi) (if(st.filled) 20.0 else 0.0) else if(st.filled && m.label.isNotEmpty()) wrapH-rowH else (wrapH-rowH-chipPad)/2+chipPad
    val font=st.restFont+(st.floatFont-st.restFont)*prog;val line=st.restLine+(st.floatLine-st.restLine)*prog
    val restTop=if(multi) (if(st.filled) 32.0 else 12.0) else wrapH/2
    val labelY=restTop+(st.floatTop-restTop)*prog+(if(st.filled) -.5*(1-prog) else -.5)*line
    val labelX=if(!st.filled && hasLeading) -(st.iconSize+st.gapLG)*prog else 0.0
    val labelColor=if(reduced) awcColor(st.label(states),Color.Black) else labelC.value(t)
    val shape=RoundedCornerShape(topStart=st.shape.dp,topEnd=st.shape.dp,bottomEnd=st.bottomRadius.dp,bottomStart=st.bottomRadius.dp)

    SideEffect { inspector?.invoke(values.toMap()) }
    Column(Modifier.fillMaxWidth().fieldPart(inspection,"",values,mapOf("focused" to rt.focused,"floating" to floating,"hover" to states.hover,
        "error" to hasError,"value" to value,"displayValue" to rt.field.value.text,"composing" to (rt.field.value.composition!=null),"passwordVisible" to rt.passwordVisible,
        "validationMessage" to validationMessage,"valid" to validity.valid,"labelProgress" to prog))) {
        Box(Modifier.fillMaxWidth().height(containerH.dp).hoverable(hoverSource,enabled=!disabled)
            .background(if(reduced) awcColor(st.container(states),Color.Transparent) else contC.value(t),shape)
            .pointerInput(disabled) { detectTapGestures { if(!disabled) rt.focus() } }
            .fieldPart(inspection,"container",values,mapOf("background" to contC.target,"padBlock" to st.padBlock,"padStart" to st.padStart,"padEnd" to st.padEnd))) {
            if(st.filled) Box(Modifier.matchParentSize().clip(shape).background(awcColor(st.onSurface,Color.Black).copy(alpha=layerT.value(t).toFloat()))
                .fieldPart(inspection,"state-layer",values,mapOf("opacity" to layerT.value(t))))
            Row(Modifier.fillMaxWidth().height(containerH.dp).padding(start=st.padStart.dp,end=st.padEnd.dp,top=st.padBlock.dp,bottom=st.padBlock.dp),
                verticalAlignment=if(multi) Alignment.Top else Alignment.CenterVertically) {
                SlotPresence({ slot?.invoke("leading-icon") },st.iconSize,{ hasLeading=it }) { content->
                    Box(Modifier.padding(end=st.gapLG.dp,top=if(fixedMulti) 16.dp else 0.dp).size(st.iconSize.dp).inspectAWCNode(inspection,"leading-icon","leading-icon"),contentAlignment=Alignment.Center) {
                        CompositionLocalProvider(androidx.compose.material3.LocalContentColor provides awcColor(st.leadingIcon(states),Color.Black),LocalAWCButtonSlotSize provides st.iconSize.dp) { content() } } }
                // The input wrap: input row at its flex position plus the absolutely positioned label (mirrored under RTL).
                Layout(content={
                    Row(verticalAlignment=if(multi) Alignment.Top else Alignment.CenterVertically) {
                        SlotPresence({ slot?.invoke("chips") },32.0,{ hasChips=it },measureWidth=true) { content-> FieldChipsFlow(m.chipsWrap,Modifier.inspectAWCNode(inspection,"chips","chips")) { content() } }
                        if(hasChips) Spacer(Modifier.width(4.dp))
                        if(m.prefixText.isNotEmpty() && floating) androidx.compose.material3.Text(m.prefixText,Modifier.padding(end=2.dp).inspectAWCNode(inspection,"prefix","prefix"),
                            style=inputStyle.copy(letterSpacing=0.sp,lineHeight=st.affixLine.sp,color=awcColor(st.affix(states),Color.Black)),maxLines=1)
                        val textColor=awcColor(st.input(states),Color.Black)
                        BasicTextField(value=rt.field.value,onValueChange={ edited(it) },enabled=!disabled,readOnly=m.readOnly,textStyle=inputStyle.copy(color=textColor),
                            singleLine=!multi,minLines=if(multi) m.effectiveRows else 1,maxLines=if(fixedMulti) m.effectiveRows else if(multi) Int.MAX_VALUE else 1,
                            visualTransformation=if(secure) PasswordVisualTransformation('•') else VisualTransformation.None,
                            keyboardOptions=KeyboardOptions(capitalization=KeyboardCapitalization.None,
                                keyboardType=when(m.inputMode.ifEmpty { m.type }) { "numeric","number" -> KeyboardType.Number; "decimal" -> KeyboardType.Decimal; "tel" -> KeyboardType.Phone
                                    "email" -> KeyboardType.Email; "url" -> KeyboardType.Uri; "password" -> if(secure) KeyboardType.Password else KeyboardType.Text; else -> KeyboardType.Text },
                                imeAction=if(multi) ImeAction.Default else when(m.enterKeyHint) { "done" -> ImeAction.Done; "go" -> ImeAction.Go; "next" -> ImeAction.Next; "search" -> ImeAction.Search; "send" -> ImeAction.Send; else -> ImeAction.Done }),
                            keyboardActions=KeyboardActions(onAny={ command("Enter") }),
                            cursorBrush=SolidColor(awcColor(st.caret(states),Color.Black)),
                            onTextLayout={ if(multi && m.multiline=="auto-grow") { val h=with(density) { it.size.height.toDp().value.toDouble() };if(abs(h-rt.multilineHeight)>.5) rt.multilineHeight=h } },
                            modifier=Modifier.weight(1f).heightIn(min=inputH.dp).let { if(multi) it else it.height(inputH.dp) }
                                .then(if(!st.filled) Modifier.offset(y=(appearance.opticalNudge ?: 0.0).dp) else Modifier)
                                .focusRequester(rt.focusRequester).onFocusChanged { focusChanged(it.isFocused) }
                                .onPreviewKeyEvent { e-> if(e.type!=KeyEventType.KeyDown) false else when(e.key) { Key.Escape -> command("Escape"); Key.Enter,Key.NumPadEnter -> if(multi) false else command("Enter")
                                    Key.DirectionUp,Key.DirectionDown,Key.MoveHome,Key.MoveEnd -> if(hooks?.key==null || e.isCtrlPressed || e.isMetaPressed || rt.field.value.composition!=null) false
                                        else command((if(e.isShiftPressed) "Shift+" else "")+(if(e.isAltPressed) "Alt+" else "")+when(e.key) { Key.DirectionUp->"ArrowUp";Key.DirectionDown->"ArrowDown";Key.MoveHome->"Home";else->"End" })
                                    // Tab / Shift+Tab reach a composite's key hook (md-autocomplete commits / closes on Tab), as on SwiftUI.
                                    Key.Tab -> if(hooks?.key==null || rt.field.value.composition!=null) false else command(if(e.isShiftPressed) "Shift+Tab" else "Tab")
                                    Key.Backspace,Key.Delete,Key.DirectionLeft,Key.DirectionRight -> if(hooks?.editingKeys!=true || e.isCtrlPressed || e.isMetaPressed || rt.field.value.composition!=null) false
                                        else command(when(e.key) { Key.Backspace->"Backspace";Key.Delete->"Delete";Key.DirectionLeft->"ArrowLeft";else->"ArrowRight" })
                                    else -> if(hooks?.readOnlyKeys==true && m.readOnly && !e.isCtrlPressed && !e.isMetaPressed && e.utf16CodePoint>=0x20 && e.utf16CodePoint!=0x7F)
                                        command(e.utf16CodePoint.toChar().toString()) else false } }
                                .semantics { contentDescription=m.label.ifEmpty { m.ariaLabel }; if(hasError) error(supportMessage.ifEmpty { validationMessage });
                                    // role="combobox" (select family): TalkBack hears the popup state with the text field's own role.
                                    stateDescription=listOf(if(m.inputRole=="combobox") (if(m.inputExpanded) "expanded" else "collapsed") else "",supportMessage,counter).filter { it.isNotEmpty() }.joinToString(" ") }
                                .fieldPart(inspection,"input",values,mapOf("value" to rt.field.value.text,"secure" to secure,"fontSize" to st.inputFont,"lineHeight" to st.inputLine,
                                    "color" to st.input(states),"caret" to st.caret(states))),
                            decorationBox={ inner-> Box(contentAlignment=if(multi) Alignment.TopStart else Alignment.CenterStart) {
                                if(rt.field.value.text.isEmpty() && floating && m.placeholder.isNotEmpty()) androidx.compose.material3.Text(m.placeholder,style=inputStyle.copy(color=awcColor(st.placeholder,Color.Black)),maxLines=1)
                                inner() } })
                        if(m.suffixText.isNotEmpty() && floating) androidx.compose.material3.Text(m.suffixText,Modifier.padding(start=2.dp).inspectAWCNode(inspection,"suffix","suffix"),
                            style=inputStyle.copy(letterSpacing=0.sp,lineHeight=st.affixLine.sp,color=awcColor(st.affix(states),Color.Black)),maxLines=1)
                    }
                    if(m.label.isNotEmpty()) androidx.compose.material3.Text(m.label,Modifier.fieldPart(inspection,"label",values,mapOf("fontSize" to font,"lineHeight" to line,"progress" to prog,"color" to labelC.target)).clearAndSetSemantics { },
                        style=TextStyle(fontFamily=FieldRoboto,fontSize=font.sp,lineHeight=line.sp,letterSpacing=0.sp,color=labelColor,textMotion=androidx.compose.ui.text.style.TextMotion.Animated,
                            lineHeightStyle=LineHeightStyle(LineHeightStyle.Alignment.Center,LineHeightStyle.Trim.None),platformStyle=PlatformTextStyle(includeFontPadding=false)),
                        maxLines=1,overflow=TextOverflow.Ellipsis)
                },modifier=Modifier.weight(1f).height(wrapH.dp)) { measurables,c->
                    val w=c.maxWidth;val px={ v:Double-> (v*density.density).roundToInt() }
                    val row=measurables[0].measure(Constraints(minWidth=w,maxWidth=w))
                    val label=measurables.getOrNull(1)?.measure(Constraints(maxWidth=w))
                    layout(w,px(wrapH)) { row.placeRelative(0,px(rowTop));label?.placeRelative(px(labelX),px(labelY)) }
                }
                if(m.clearable!=FieldMode.Off) FieldActionButton("cancel","Clear",null,clearDisabled,value.isEmpty(),st,states,{ c,h-> st.action(states,clearDisabled,h) },"clear",inspection,values,{ slot?.invoke("clear-icon") }) {
                    if(!disabled && !m.readOnly && value.isNotEmpty()) { if(m.clearable==FieldMode.Internal) clearValue();emit("mdClear",null);rt.focus() } }
                if(m.showPasswordToggle) FieldActionButton(if(revealedPw) "visibility_off" else "visibility",if(revealedPw) m.hidePasswordLabel else m.showPasswordLabel,revealedPw,disabled,false,st,states,
                    { _,h-> st.action(states,disabled,h) },"password-toggle",inspection,values,{ slot?.invoke("password-toggle-icon") }) {
                    if(!disabled) { if(m.passwordToggle==FieldMode.Internal) { rt.passwordVisible=!rt.passwordVisible;emit("mdPasswordToggle",mapOf("visible" to rt.passwordVisible)) }
                        else emit("mdPasswordToggle",mapOf("visible" to (m.type=="password")));rt.focus() } }
                if(m.speechToText!=FieldMode.Off) FieldActionButton(if(rt.listening) "hearing" else "mic",if(rt.listening) "Stop listening" else "Start voice input",rt.listening,disabled || m.readOnly,false,st,states,
                    { _,h-> st.action(states,disabled || m.readOnly,h,rt.listening) },"speech",inspection,values,{ slot?.invoke("speech-icon") }) {
                    if(!disabled && !m.readOnly) { if(m.speechToText==FieldMode.External) { rt.listening=!rt.listening;emit("mdSpeechResult",mapOf("transcript" to "","listening" to rt.listening)) }
                        else toggleSpeech() } }
                if(hasError) Box(Modifier.padding(start=st.gapLG.dp,top=if(fixedMulti) 16.dp else 0.dp).size(st.iconSize.dp).inspectAWCNode(inspection,"error-icon","error-icon").clearAndSetSemantics { },contentAlignment=Alignment.Center) {
                    var authoredError by remember { mutableStateOf(false) }
                    SlotPresence({ slot?.invoke("error-icon") },st.iconSize,{ authoredError=it }) { content->
                        CompositionLocalProvider(androidx.compose.material3.LocalContentColor provides awcColor(st.errorColor,Color.Red),LocalAWCButtonSlotSize provides st.iconSize.dp) { content() } }
                    if(!authoredError) FieldGlyph("error",st.iconSize,1.0,awcColor(st.errorColor,Color.Red)) }
                // `.md-text-field__error-icon + .md-text-field__trailing-icon-button { margin-inline-start: 4px }`
                if(hooks?.trailing!=null) Box(Modifier.padding(start=if(hasError) 4.dp else 0.dp)) { hooks.trailing.invoke() }
                else SlotPresence({ slot?.invoke("trailing-icon") },st.iconSize,{ hasTrailing=it }) { content->
                    Box(Modifier.padding(top=if(fixedMulti) 16.dp else 0.dp).inspectAWCNode(inspection,"trailing-icon","trailing-icon"),contentAlignment=Alignment.Center) {
                        CompositionLocalProvider(androidx.compose.material3.LocalContentColor provides awcColor(st.trailingIcon(states),Color.Black),LocalAWCButtonSlotSize provides st.iconSize.dp) { content() } } }
            }
            // Indicator / fieldset + legend notch: drawn over the box, outside layout.
            val o=st.outline(states)
            val legendText=remember(m.label,st.legendFont) { if(m.label.isEmpty()) 0.0 else measurer.measure(AnnotatedString(m.label),TextStyle(fontFamily=FieldRoboto,fontSize=st.legendFont.sp)).size.width/density.density.toDouble() }
            if(st.filled) { val h=if(reduced) ind.first else indH.value(t);val c=if(reduced) awcColor(ind.second,Color.Black) else indC.value(t)
                Box(Modifier.matchParentSize().alpha(st.indicatorOpacity.toFloat()).fieldPart(inspection,"indicator",values,mapOf("height" to h,"color" to indC.target)).drawBehind {
                    drawRect(c,topLeft=Offset(0f,size.height-(h*density.density).toFloat()),size=Size(size.width,(h*density.density).toFloat())) }) }
            else { val c=if(reduced) awcColor(o.color,Color.Black) else outC.value(t)
                val maxContent={ w:Double-> max(0.0,w-2*o.width-(st.padStart-5)-(st.padEnd-5)) }
                // The inspected notch is the drawn one: max-width interpolates from the fieldset's content width (Chrome), not
                // from "unbounded" (which kept the text width until the transition's last frame).
                val boxW=remember { mutableDoubleStateOf(0.0) }
                val inspectedContent=if(boxW.doubleValue>0) { val w=boxW.doubleValue-2*o.inset;min(legendText,min(maxContent(w),legendP*maxContent(w))) } else min(legendText,legendP*1e6)
                Box(Modifier.matchParentSize().layout { meas,cons-> val pl=meas.measure(cons);layout(pl.width,pl.height) { pl.place(0,0) } }
                    .onSizeChanged { boxW.doubleValue=it.width/density.density.toDouble() }
                    .fieldPart(inspection,"fieldset",values,mapOf("borderWidth" to o.width,"color" to outC.target,"legendStart" to (o.width+st.padStart-5),
                        "legendWidth" to (if(m.label.isEmpty()) 0.0 else max(0.0,inspectedContent+8*legendP)),"inset" to o.inset)).drawBehind {
                    val k=density.density;val inset=(o.inset*k).toFloat();val bw=(o.width*k).toFloat()
                    val r0=Rect(inset,inset,size.width-inset,size.height-inset);val rr=(st.shape*k).toFloat()
                    val w=r0.width/k;val content=min(legendText,min(maxContent(w.toDouble()),legendP*maxContent(w.toDouble())));val lw=if(m.label.isEmpty()) 0.0 else max(0.0,content+8*legendP)
                    val start=((o.width+st.padStart-5)*k).toFloat();val gap=(lw*k).toFloat()
                    val path=Path().apply { fillType=PathFillType.EvenOdd
                        addRoundRect(RoundRect(r0,CornerRadius(rr,rr)))
                        val inner=Rect(r0.left+bw,r0.top+bw,r0.right-bw,r0.bottom-bw);val ir=max(0f,rr-bw)
                        if(inner.width>0 && inner.height>0) addRoundRect(RoundRect(inner,CornerRadius(ir,ir)))
                        if(gap>0) addRect(if(rtl) Rect(r0.right-start-gap,r0.top,r0.right-start,r0.top+bw) else Rect(r0.left+start,r0.top,r0.left+start+gap,r0.top+bw)) }
                    drawPath(path,c) }) }
        }
        val count=counter
        if(supportMessage.isNotEmpty() || count.isNotEmpty() || m.reserveSupportingSpace) {
            val sStyle=TextStyle(fontFamily=FieldRoboto,fontSize=st.supportFont.sp,textMotion=androidx.compose.ui.text.style.TextMotion.Animated,lineHeight=st.supportLine.sp,lineHeightStyle=LineHeightStyle(LineHeightStyle.Alignment.Center,LineHeightStyle.Trim.None),
                platformStyle=PlatformTextStyle(includeFontPadding=false))
            // CSS: display:flex; justify-content:space-between; gap:16px; padding:4px 16px 0 — the text shrinks, the counter does not.
            Layout(content={
                androidx.compose.material3.Text(supportMessage.ifEmpty { if(m.reserveSupportingSpace) "\u200B" else "" },Modifier
                    .fieldPart(inspection,"supporting-text",values,mapOf("role" to (if(hasError) "alert" else "")),allowZeroSize=true)
                    .semantics { if(hasError) liveRegion=LiveRegionMode.Assertive },style=sStyle.copy(color=awcColor(st.support(states),Color.Black)))
                if(count.isNotEmpty()) androidx.compose.material3.Text(count,Modifier.inspectAWCNode(inspection,"counter","counter"),style=sStyle.copy(color=awcColor(st.counter(states),Color.Black)),maxLines=1)
            },modifier=Modifier.fillMaxWidth().padding(start=16.dp,end=16.dp,top=4.dp)) { ms,cons->
                val w=cons.maxWidth;val gap=16.dp.roundToPx()
                val counterP=ms.getOrNull(1)?.measure(Constraints(0,w,0,cons.maxHeight))
                val textMax=max(0,w-(counterP?.let { it.width+gap } ?: 0))
                val textP=ms[0].measure(Constraints(0,textMax,0,cons.maxHeight))
                val h=max(textP.height,counterP?.height ?: 0)
                layout(w,h) { textP.placeRelative(0,0);counterP?.placeRelative(w-counterP.width,0) } }
        }
    }
}

internal val LocalAWCTextFieldInspector=staticCompositionLocalOf<((Map<String,Map<String,Any?>>)->Unit)?> { null }
/** Opt-in values of every measured part (font sizes, colours, progress …), keyed by part name ("" = the host). */
@Composable fun AWCTextFieldInspectionScope(onField:(Map<String,Map<String,Any?>>)->Unit,content:@Composable ()->Unit)=
    CompositionLocalProvider(LocalAWCTextFieldInspector provides onField,content=content)
/** A measured part (collector bounds) plus its values for AWCTextFieldInspectionScope. */
@Composable internal fun Modifier.fieldPart(inspection:AWCInspectionContext?,part:String,values:MutableMap<String,Map<String,Any?>>,v:Map<String,Any?>,allowZeroSize:Boolean=false):Modifier {
    values[part]=v
    return inspectAWCNode(inspection,part,if(part.isEmpty()) "md-text-field" else part,allowZeroSize=allowZeroSize)
}

/** `.md-text-field__chips`: inline-flex, gap 4; `chips-wrap` wraps rows 6 apart, otherwise one clipped row. The input keeps 40 + 4. */
@Composable private fun FieldChipsFlow(wrap:Boolean,modifier:Modifier,content:@Composable ()->Unit)=Layout(content,if(wrap) modifier else modifier.clipToBounds()) { ms,cons->
    val gap=4.dp.roundToPx();val rowGap=6.dp.roundToPx()
    val maxW=if(cons.hasBoundedWidth) (cons.maxWidth-44.dp.roundToPx()).coerceAtLeast(0) else Int.MAX_VALUE
    val ps=ms.map { it.measure(Constraints()) }
    var x=0;var y=0;var rowH=0;var w=0;val pos=ArrayList<IntArray>()
    for(p in ps) { if(wrap && x>0 && x+p.width>maxW) { y+=rowH+rowGap;x=0;rowH=0 }
        val px=if(x>0) x+gap else 0;pos.add(intArrayOf(px,y));x=px+p.width;rowH=max(rowH,p.height);w=max(w,x) }
    layout(min(w,maxW),y+rowH) { ps.forEachIndexed { i,p-> p.placeRelative(pos[i][0],pos[i][1]) } }
}

/** Measures authored slot content: present when it has an intrinsic width (the source's slotchange state). */
@Composable private fun SlotPresence(slotContent:@Composable ()->Unit,size:Double,onPresence:(Boolean)->Unit,measureWidth:Boolean=false,wrapper:@Composable (@Composable ()->Unit)->Unit) {
    var present by remember { mutableStateOf(false) }
    if(present) wrapper(slotContent)
    else Layout(content=slotContent,modifier=Modifier.size(0.dp)) { ms,_->
        val authored=ms.any { it.maxIntrinsicWidth(1000)>0 }
        if(authored!=present) { present=authored;onPresence(authored) }
        layout(0,0) {}
    }
}

@Composable private fun FieldGlyph(name:String,size:Double,fill:Double,color:Color) {
    val family=remember(fill) { FontFamily(Font(R.font.awc_material_symbols,FontWeight.Normal,variationSettings=FontVariation.Settings(FontVariation.Setting("FILL",fill.toFloat()),FontVariation.Setting("opsz",24f)))) }
    val fs=with(LocalDensity.current) { size.dp.toSp() }
    Box(Modifier.size(size.dp).clearAndSetSemantics { },contentAlignment=Alignment.Center) {
        androidx.compose.material3.Text(name,Modifier.wrapContentSize(unbounded=true),color=color,fontFamily=family,fontSize=fs,lineHeight=fs,style=TextStyle(platformStyle=PlatformTextStyle(includeFontPadding=false)))
    }
}

/** Clear / password toggle / speech: a 40×40 (min) target, margins −6/−8, focus ring 6 dp inside. */
@Composable private fun FieldActionButton(glyph:String,label:String,pressed:Boolean?,disabled:Boolean,hidden:Boolean,st:TextFieldStyle,s:TextFieldStates,
                                          ink:(String,Boolean)->Pair<String,Double>,part:String,inspection:AWCInspectionContext?,values:MutableMap<String,Map<String,Any?>>,icon:@Composable ()->Unit,action:()->Unit) {
    val box=max(40.0,st.iconSize);val src=remember { MutableInteractionSource() };val hovered by src.collectIsHoveredAsState()
    var focused by remember { mutableStateOf(false) }
    val (hex,op)=ink(glyph,hovered)
    Box(Modifier.layout { m,c-> val pl=m.measure(Constraints.fixed((box*density).roundToInt(),(box*density).roundToInt()))
            layout(((box-12)*density).roundToInt(),((box-16)*density).roundToInt()) { pl.placeRelative((-6*density).roundToInt(),(-8*density).roundToInt()) } }
        .fieldPart(inspection,part,values,mapOf("disabled" to disabled,"label" to label,"pressed" to pressed))
        .alpha(if(hidden) 0f else 1f)
        .hoverable(src,enabled=!disabled)
        .onFocusChanged { focused=it.isFocused }.focusable(!disabled)
        .pointerInput(disabled) { detectTapGestures { if(!disabled) action() } }
        .onPreviewKeyEvent { e-> if(e.type==KeyEventType.KeyDown && (e.key==Key.Spacebar || e.key==Key.Enter) && !disabled) { action();true } else false }
        .semantics(mergeDescendants=true) { contentDescription=label;role=Role.Button;if(disabled) disabled();if(pressed!=null) selected=pressed;onClick(label) { if(!disabled) action();true } },
        contentAlignment=Alignment.Center) {
        if(focused && !disabled) Box(Modifier.size((box-12).dp).border(2.dp,awcColor(st.ring,Color.Black),CircleShape))
        Box(Modifier.size(st.iconSize.dp).alpha(op.toFloat()),contentAlignment=Alignment.Center) {
            var authored by remember { mutableStateOf(false) }
            SlotPresence(icon,st.iconSize,{ authored=it }) { c-> CompositionLocalProvider(androidx.compose.material3.LocalContentColor provides awcColor(hex,Color.Black)) { c() } }
            if(!authored) FieldGlyph(glyph,st.iconSize,0.0,awcColor(hex,Color.Black))
        }
    }
}
