package dev.awc.nativeui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf

/**
 * Constraint validity of md-switch / md-checkbox / md-radio in the source's `getValidity()` shape: a custom message
 * (`setCustomValidity`) wins as `customError`; otherwise an empty required control is `valueMissing` with its
 * `valueMissingLabel`.
 */
data class AWCSelectionValidity(val valid:Boolean,val validationMessage:String,val flags:Map<String,Boolean>) {
    /** `{ valid, validationMessage, flags }` (the source method's resolved value). */
    fun toValue():Map<String,AWCValue> = mapOf("valid" to valid,"validationMessage" to validationMessage,"flags" to flags)
    companion object {
        /** The ten `ValidityState` flags Chrome reports (`valid` is the summary, not a flag). */
        val flagNames=listOf("valueMissing","typeMismatch","patternMismatch","tooLong","tooShort","rangeUnderflow","rangeOverflow","stepMismatch","badInput","customError")
        fun of(missing:Boolean,missingMessage:String,customMessage:String):AWCSelectionValidity {
            val f=flagNames.associateWith { false }.toMutableMap()
            return when {
                customMessage.isNotEmpty() -> { f["customError"]=true;AWCSelectionValidity(false,customMessage,f) }
                missing -> { f["valueMissing"]=true;AWCSelectionValidity(false,missingMessage,f) }
                else -> AWCSelectionValidity(true,"",f)
            }
        }
    }
}

internal class AWCSelectionControlHandle {
    var setFocus:()->Boolean={ false }
    var setBlur:()->Unit={}
    var select:()->Unit={}
    var validity:()->AWCSelectionValidity={ AWCSelectionValidity.of(false,"","") }
    var barred:()->Boolean={ false }
    var reveal:()->Unit={}
    var setCustom:(String)->Unit={}
}

/**
 * Native counterparts of the md-switch / md-checkbox / md-radio methods: `setFocus`, `setBlur`, `select` (radio),
 * `getValidity`, `checkValidity`, `reportValidity`, `setCustomValidity` and `syncValidityFromGroup`. Attach with
 * [AWCSelectionControlControllerScope] to the control with that `id` property, or to every descendant selection
 * control when no id is given.
 */
@Stable class AWCSelectionControlController {
    internal var handle:AWCSelectionControlHandle? by mutableStateOf(null)
    val isConnected:Boolean get()=handle!=null
    /** Focuses the control with its visible programmatic focus ring. */
    fun setFocus():Boolean=handle?.setFocus?.invoke() ?: false
    /** Removes focus from the control. */
    fun setBlur() { handle?.setBlur?.invoke() }
    /** md-radio `select()`: checks an enabled, unchecked radio (siblings uncheck silently) and emits `mdChange`. */
    fun select() { handle?.select?.invoke() }
    /** The current validity (`valid`, `validationMessage`, `flags`). */
    fun getValidity():AWCSelectionValidity=handle?.validity?.invoke() ?: AWCSelectionValidity.of(false,"","")
    /** Validity without presenting it. A hard-disabled control is barred from validation and reports true. */
    fun checkValidity():Boolean { val h=handle ?: return true;return h.barred() || h.validity().valid }
    /** Like [checkValidity], but an invalid control shows its message inline (kept in sync while it stays invalid) and takes focus with its focus ring. */
    fun reportValidity():Boolean { val h=handle ?: return true;if(h.barred() || h.validity().valid) return true;h.reveal();return false }
    /** A non-empty message marks the control invalid (`customError`) until it is cleared with an empty string. */
    fun setCustomValidity(message:String) { handle?.setCustom?.invoke(message) }
    /** md-radio group coordination: validity and the roving tab stop are derived natively, so this is a refresh. */
    fun syncValidityFromGroup() {}
}
internal val LocalAWCSelectionControllers=staticCompositionLocalOf { emptyMap<String,AWCSelectionControlController>() }
/** Attaches [controller] to the selection control whose `id` property is [id] (any descendant selection control when empty). */
@Composable fun AWCSelectionControlControllerScope(controller:AWCSelectionControlController,id:String="",content:@Composable ()->Unit) {
    val inherited=LocalAWCSelectionControllers.current
    CompositionLocalProvider(LocalAWCSelectionControllers provides inherited+(id to controller),content=content)
}

/** Per-control validation presentation (the source's InlineValidationPresenter). */
internal class SelectionValidationState {
    var customMessage by mutableStateOf("")
    var revealed by mutableStateOf(false)
    var lastKey:String?=null
    var resetToken:Any?=null
    val handle=AWCSelectionControlHandle()
    var validity=AWCSelectionValidity.of(false,"","")
    /** The message to present inline, if revealed and still invalid. */
    val shown:String? get()=if(revealed && !validity.valid) validity.validationMessage else null
    /** Focus and blur need the renderer's focus requester: bound after it exists. */
    fun bind(focus:()->Boolean,blur:()->Unit,select:()->Unit) { handle.setFocus=focus;handle.setBlur=blur;handle.select=select }
}
/**
 * Validity, presentation and the method controller of one selection control. A reported, invalid control shows its
 * message until it becomes valid, its name changes, it is disabled or its form resets; validity changes (after the
 * first evaluation) emit `mdValidityChange` through [changed].
 */
@Composable internal fun rememberSelectionValidation(id:String,missing:Boolean,missingMessage:String,barred:Boolean,name:String,formReset:Any?,
                                                     changed:(Map<String,AWCValue>)->Unit):SelectionValidationState {
    val st=remember { SelectionValidationState() }
    val validity=AWCSelectionValidity.of(missing,missingMessage,st.customMessage)
    st.validity=validity
    val controllers=LocalAWCSelectionControllers.current
    val h=st.handle
    h.validity={ AWCSelectionValidity.of(missing,missingMessage,st.customMessage) };h.barred={ barred }
    h.setCustom={ st.customMessage=it };h.reveal={ st.revealed=true;h.setFocus() }
    SideEffect { (controllers[id] ?: controllers[""])?.handle=h }
    val token=listOf(name,formReset)
    SideEffect {
        if(st.resetToken!=null && st.resetToken!=token) st.revealed=false
        st.resetToken=token
        if(barred && st.revealed) st.revealed=false
        val key="${validity.valid}|${validity.validationMessage}"
        val last=st.lastKey;st.lastKey=key
        if(last!=null && last!=key) changed(validity.toValue())
    }
    return st
}

/** md-chip hook appearance under the `<type>Scope` name the Laboratory's copied snippets use. */
@Composable fun AWCChipHookAppearanceScope(appearance:AWCChipHookAppearance,content:@Composable ()->Unit)=AWCChipAppearanceScope(appearance,content)
