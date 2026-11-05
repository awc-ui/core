package dev.awc.playground

import dev.awc.nativeui.AWCOTPFieldAppearance
import dev.awc.nativeui.AWCOTPFieldController
import dev.awc.nativeui.AWCValue
import org.json.JSONArray
import org.json.JSONObject

/** md-otp-field in the Laboratory: the seven typed hooks, retained updates of every source property and the methods. */
private fun otpFieldValues(request:JSONObject,field:String):Map<String,AWCValue> {
    val obj=request.optJSONObject(field) ?: return emptyMap()
    return obj.keys().asSequence().associateWith { obj.opt(it).takeIf { v-> v!=JSONObject.NULL } }
}
/** Defaults first, local values win (the nearer custom property). */
internal fun parseLivePreviewOTPFieldAppearance(request:JSONObject)=
    AWCOTPFieldAppearance.fromValues(otpFieldValues(request,"otpFieldAppearanceDefaults")).merge(AWCOTPFieldAppearance.fromValues(otpFieldValues(request,"otpFieldAppearance")))

private val otpBooleans=setOf("mask","autoSubmit","disabled","readOnly","required","error","reserveSupportingSpace")
private val otpStrings=setOf("value","inputMode","name","errorText","supportingText","label","cellLabelTemplate","valueMissingLabel","incompleteLabel")
private fun otpCount(v:Any?,min:Int)=v is Number && v.toDouble().let { it>=min && it<=64 && it==Math.floor(it) }
/** Retained property updates with the source property types. */
internal fun parseLivePreviewOTPFieldUpdate(request:JSONObject):Map<String,AWCValue> {
    require(request.keys().asSequence().all { it in setOf("command","properties") } && request.optString("command")=="update") { "Expected a property update." }
    val properties=request.getJSONObject("properties")
    require(properties.length()>0) { "A property update must contain at least one field." }
    return properties.keys().asSequence().associateWith { name->
        val raw=properties.get(name);val value=if(raw==JSONObject.NULL) null else raw
        when {
            name in otpBooleans->require(value is Boolean) { "$name must be Boolean." }
            name in otpStrings->require(value is String && value.toByteArray().size<=4096) { "$name must be a string of at most 4096 UTF-8 bytes." }
            name=="length"->require(otpCount(value,1)) { "length must be an integer from 1 to 64." }
            name=="groupSize"->require(otpCount(value,0)) { "groupSize must be an integer from 0 to 64." }
            name=="validationType"->require(value in setOf("numeric","alpha","alphanumeric","none")) { "Invalid validationType." }
            name=="transform"->require(value in setOf("none","uppercase")) { "transform must be none or uppercase." }
            name=="density"->require(value is Number && value.toDouble() in setOf(0.0,-1.0,-2.0,-3.0,-4.0)) { "Invalid density." }
            else->throw IllegalArgumentException("Unknown md-otp-field property: $name")
        }
        if(value is Number) value.toDouble() else value
    }
}

/** setFocus / clear / getValidity / setCustomValidity / checkValidity / reportValidity through the native controller. */
internal fun invokeLivePreviewOTPFieldMethod(request:JSONObject,controller:AWCOTPFieldController):Any? {
    val method=request.optString("method");val args=request.optJSONArray("arguments") ?: JSONArray()
    require(method in setOf("setFocus","clear","getValidity","setCustomValidity","checkValidity","reportValidity")) { "Unsupported native method." }
    check(controller.isConnected) { "The md-otp-field is not mounted." }
    if(method=="setCustomValidity") {
        require(args.length()==1 && args.get(0) is String && (args.get(0) as String).toByteArray().size<=4096) { "setCustomValidity requires one string of at most 4096 UTF-8 bytes." }
        controller.setCustomValidity(args.getString(0));return null
    }
    require(args.length()==0) { "$method requires no arguments." }
    return when(method) {
        "setFocus"->{ controller.setFocus();null }
        "clear"->{ controller.clear();null }
        "checkValidity"->controller.checkValidity()
        "reportValidity"->controller.reportValidity()
        else->controller.getValidity().let { v-> JSONObject().put("valid",v.valid).put("validationMessage",v.validationMessage).put("flags",JSONObject(v.flags)) }
    }
}
