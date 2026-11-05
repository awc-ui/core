package dev.awc.playground

import dev.awc.nativeui.AWCNumberFieldAppearance
import dev.awc.nativeui.AWCNumberFieldController
import dev.awc.nativeui.AWCValue
import org.json.JSONArray
import org.json.JSONObject

/** md-number-field in the Laboratory: the five typed hooks, retained updates of every source property and the methods. */
private fun numberFieldValues(request:JSONObject,field:String):Map<String,AWCValue> {
    val obj=request.optJSONObject(field) ?: return emptyMap()
    return obj.keys().asSequence().associateWith { obj.opt(it).takeIf { v-> v!=JSONObject.NULL } }
}
/** Defaults first, local values win (the nearer custom property). */
internal fun parseLivePreviewNumberFieldAppearance(request:JSONObject)=
    AWCNumberFieldAppearance.fromValues(numberFieldValues(request,"numberFieldAppearanceDefaults")).merge(AWCNumberFieldAppearance.fromValues(numberFieldValues(request,"numberFieldAppearance")))

private val numberFieldBooleans=setOf("error","disabled","readOnly","required","snapOnStep","allowOutOfRange","allowWheelScrub","reserveSupportingSpace")
private val numberFieldStrings=setOf("label","placeholder","supportingText","errorText","name","locale","incrementLabel","decrementLabel","valueMissingLabel")
private fun numberTextOK(v:Any?)=v is String && v.toByteArray().size<=4096
private fun finiteOK(v:Any?)=v is Number && v.toDouble().isFinite()
/** Intl.NumberFormat options as data: at most 32 letter keys with string, number or boolean values. */
private fun formatOptionsOK(v:Any?):Boolean = v==null || numberTextOK(v) || v is JSONObject && v.length()<=32 && v.keys().asSequence().all { k->
    k.length in 1..40 && k.all { it in 'a'..'z' || it in 'A'..'Z' } && v.get(k).let { x-> numberTextOK(x) || finiteOK(x) || x is Boolean } }
/** Retained property updates with the source property types. formatOptions travels as its JSON text. */
internal fun parseLivePreviewNumberFieldUpdate(request:JSONObject):Map<String,AWCValue> {
    require(request.keys().asSequence().all { it in setOf("command","properties") } && request.optString("command")=="update") { "Expected a property update." }
    val properties=request.getJSONObject("properties")
    require(properties.length()>0) { "A property update must contain at least one field." }
    return properties.keys().asSequence().associateWith { name->
        val raw=properties.get(name);val value=if(raw==JSONObject.NULL) null else raw
        when {
            name in numberFieldBooleans->require(value is Boolean) { "$name must be Boolean." }
            name in numberFieldStrings->require(numberTextOK(value)) { "$name must be a string of at most 4096 UTF-8 bytes." }
            name in setOf("value","min","max")->require(value==null || finiteOK(value)) { "$name must be a finite number or null." }
            name in setOf("step","smallStep","largeStep")->require(finiteOK(value)) { "$name must be a finite number." }
            name=="variant"->require(value in setOf("filled","outlined")) { "Invalid variant." }
            name=="steppers"->require(value in setOf("inline","split","none")) { "steppers must be inline, split or none." }
            name=="density"->require(value is Number && value.toDouble() in setOf(0.0,-1.0,-2.0,-3.0,-4.0)) { "Invalid density." }
            name=="formatOptions"->require(formatOptionsOK(value)) { "formatOptions must be Intl.NumberFormat options." }
            else->throw IllegalArgumentException("Unknown md-number-field property: $name")
        }
        when(value) { is Number->value.toDouble(); is JSONObject->value.toString(); else->value }
    }
}

/** setFocus / select / stepUp / stepDown / getValidity / checkValidity / reportValidity / setCustomValidity through the native controller. */
internal fun invokeLivePreviewNumberFieldMethod(request:JSONObject,controller:AWCNumberFieldController):Any? {
    val method=request.optString("method");val args=request.optJSONArray("arguments") ?: JSONArray()
    require(method in setOf("setFocus","select","stepUp","stepDown","getValidity","checkValidity","reportValidity","setCustomValidity")) { "Unsupported native method." }
    check(controller.isConnected) { "The md-number-field is not mounted." }
    if(method=="setCustomValidity") {
        require(args.length()==1 && args.get(0) is String && (args.get(0) as String).toByteArray().size<=4096) { "setCustomValidity requires one string of at most 4096 UTF-8 bytes." }
        controller.setCustomValidity(args.getString(0));return null
    }
    if(method=="stepUp" || method=="stepDown") {
        require(args.length()==0 || args.length()==1 && finiteOK(args.get(0))) { "$method accepts no arguments or one finite repeat count." }
        val times=if(args.length()==1) (args.get(0) as Number).toDouble() else 1.0
        if(method=="stepUp") controller.stepUp(times) else controller.stepDown(times);return null
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
