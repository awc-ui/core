package dev.awc.playground

import dev.awc.nativeui.AWCTextFieldAppearance
import dev.awc.nativeui.AWCTextFieldController
import dev.awc.nativeui.AWCValue
import org.json.JSONArray
import org.json.JSONObject

/** md-text-field in the Laboratory: the seventeen typed hooks, retained updates of every source property and the methods. */
private fun textFieldValues(request:JSONObject,field:String):Map<String,AWCValue> {
    val obj=request.optJSONObject(field) ?: return emptyMap()
    return obj.keys().asSequence().associateWith { obj.opt(it).takeIf { v-> v!=JSONObject.NULL } }
}
/** Defaults first, local values win (the nearer custom property). */
internal fun parseLivePreviewTextFieldAppearance(request:JSONObject)=
    AWCTextFieldAppearance.fromValues(textFieldValues(request,"textFieldAppearanceDefaults")).merge(AWCTextFieldAppearance.fromValues(textFieldValues(request,"textFieldAppearance")))

private val textFieldBooleans=setOf("reserveSupportingSpace","spellcheck","disabled","readOnly","required","error","appearFocused","chipsWrap","inputExpanded")
private val textFieldModes=setOf("clearable","passwordToggle","speechToText")
private val textFieldCounts=setOf("minLength","maxLength","rows","debounce","throttle")
private val textFieldStrings=setOf("label","value","placeholder","type","name","pattern","autocomplete","inputMode","enterKeyHint","autoCapitalize","errorText",
    "supportingText","prefixText","suffixText","showPasswordLabel","hidePasswordLabel","speechLang","restrict")
private fun textOK(v:Any?)=v is String && v.toByteArray().size<=4096
/** Retained property updates with the source property types (formatter/parser are closures: native API only). */
internal fun parseLivePreviewTextFieldUpdate(request:JSONObject):Map<String,AWCValue> {
    require(request.keys().asSequence().all { it in setOf("command","properties") } && request.optString("command")=="update") { "Expected a property update." }
    val properties=request.getJSONObject("properties")
    require(properties.length()>0) { "A property update must contain at least one field." }
    return properties.keys().asSequence().associateWith { name->
        val raw=properties.get(name);val value=if(raw==JSONObject.NULL) null else raw
        when {
            name in textFieldBooleans->require(value is Boolean) { "$name must be Boolean." }
            name in textFieldModes->require(value is Boolean || value in setOf("internal","external")) { "$name must be a Boolean, internal or external." }
            name in textFieldCounts->require(value==null || value is Number && value.toDouble().let { it>=0 && it<=1e6 && it==Math.floor(it) }) { "$name must be a nonnegative integer." }
            name in textFieldStrings->require(textOK(value)) { "$name must be a string of at most 4096 UTF-8 bytes." }
            name in setOf("min","max","step")->require(value==null || value is Number && value.toDouble().isFinite() || textOK(value)) { "$name must be a number or a string." }
            name=="variant"->require(value in setOf("filled","outlined")) { "Invalid variant." }
            name=="density"->require(value is Number && value.toDouble() in setOf(0.0,-1.0,-2.0,-3.0,-4.0)) { "Invalid density." }
            name=="multiline"->require(value==false || value in setOf("auto-grow","fixed")) { "multiline must be false, auto-grow or fixed." }
            name=="formatOn"->require(value in setOf("blur","input")) { "formatOn must be blur or input." }
            name=="focusBorderWidth"->require(value is Number && value.toDouble().let { it.isFinite() && it>=0 && it<=64 }) { "Invalid focusBorderWidth." }
            name=="inputRole"->require(value in setOf("","combobox")) { "Invalid inputRole." }
            name=="inputAriaAutocomplete"->require(value in setOf("","none","inline","list","both")) { "Invalid inputAriaAutocomplete." }
            else->throw IllegalArgumentException("Unknown md-text-field property: $name")
        }
        if(value is Number) value.toDouble() else value
    }
}

/** setFocus / select / getValidity / checkValidity / reportValidity / setCustomValidity through the native controller. */
internal fun invokeLivePreviewTextFieldMethod(request:JSONObject,controller:AWCTextFieldController):Any? {
    val method=request.optString("method");val args=request.optJSONArray("arguments") ?: JSONArray()
    require(method in setOf("setFocus","select","getValidity","checkValidity","reportValidity","setCustomValidity")) { "Unsupported native method." }
    check(controller.isConnected) { "The md-text-field is not mounted." }
    if(method=="setCustomValidity") {
        require(args.length()==1 && args.get(0) is String && (args.get(0) as String).toByteArray().size<=4096) { "setCustomValidity requires one string of at most 4096 UTF-8 bytes." }
        controller.setCustomValidity(args.getString(0));return null
    }
    require(args.length()==0) { "$method requires no arguments." }
    return when(method) {
        "setFocus"->{ controller.setFocus();null }
        "select"->{ controller.select();null }
        "checkValidity"->controller.checkValidity()
        "reportValidity"->controller.reportValidity()
        else->controller.getValidity().let { v-> JSONObject().put("valid",v.valid).put("validationMessage",v.validationMessage).put("flags",JSONObject(v.flags)) }
    }
}
