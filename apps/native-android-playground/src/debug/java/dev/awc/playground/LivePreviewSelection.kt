package dev.awc.playground

import dev.awc.nativeui.AWCCheckboxAppearance
import dev.awc.nativeui.AWCChipHookAppearance
import dev.awc.nativeui.AWCRadioAppearance
import dev.awc.nativeui.AWCSelectionControlController
import dev.awc.nativeui.AWCSwitchAppearance
import dev.awc.nativeui.AWCValue
import org.json.JSONArray
import org.json.JSONObject

/** Selection controls in the Laboratory: md-switch, md-checkbox, md-radio (validation and focus methods) and md-chip. */
internal val livePreviewSelectionTags=setOf("md-switch","md-checkbox","md-radio","md-chip")

private fun selectionValues(request:JSONObject,field:String):Map<String,AWCValue> {
    fun value(input:Any?,depth:Int=0):Any?=if(depth>8) null else when(input) {
        is JSONObject->input.keys().asSequence().associateWith { value(input.opt(it),depth+1) }
        is JSONArray->List(input.length()) { value(input.opt(it),depth+1) }
        JSONObject.NULL->null
        else->input
    }
    val obj=request.optJSONObject(field) ?: return emptyMap()
    return obj.keys().asSequence().associateWith { value(obj.opt(it)) }
}
/** Typed hooks from the request (lengths as dp numbers, corners and shadows structured); defaults first, local values win. */
internal fun parseLivePreviewSwitchAppearance(request:JSONObject)=AWCSwitchAppearance.fromValues(selectionValues(request,"switchAppearanceDefaults")).merge(AWCSwitchAppearance.fromValues(selectionValues(request,"switchAppearance")))
internal fun parseLivePreviewCheckboxAppearance(request:JSONObject)=AWCCheckboxAppearance.fromValues(selectionValues(request,"checkboxAppearanceDefaults")).merge(AWCCheckboxAppearance.fromValues(selectionValues(request,"checkboxAppearance")))
internal fun parseLivePreviewRadioAppearance(request:JSONObject)=AWCRadioAppearance.fromValues(selectionValues(request,"radioAppearanceDefaults")).merge(AWCRadioAppearance.fromValues(selectionValues(request,"radioAppearance")))
internal fun parseLivePreviewChipAppearance(request:JSONObject)=AWCChipHookAppearance.fromValues(selectionValues(request,"chipAppearanceDefaults")).merge(AWCChipHookAppearance.fromValues(selectionValues(request,"chipAppearance")))

/** Retained property updates with the source property types. */
internal fun parseLivePreviewSelectionUpdate(tag:String,request:JSONObject):Map<String,AWCValue> {
    require(request.keys().asSequence().all { it in setOf("command","properties") } && request.optString("command")=="update") { "Expected a property update." }
    val properties=request.getJSONObject("properties")
    require(properties.length()>0) { "A property update must contain at least one field." }
    val booleans=mapOf("md-switch" to setOf("selected","disabled","softDisabled","required","icons","showOnlySelectedIcon"),
        "md-checkbox" to setOf("checked","indeterminate","disabled","softDisabled","required","error"),
        "md-radio" to setOf("checked","disabled","softDisabled","required"),
        "md-chip" to setOf("selected","selectable","elevated","disabled","softDisabled","removable"))[tag].orEmpty()
    val strings=mapOf("md-switch" to setOf("name","value","selectedIcon","unselectedIcon","valueMissingLabel"),
        "md-checkbox" to setOf("name","value","errorText","supportingText","valueMissingLabel"),
        "md-radio" to setOf("name","value","valueMissingLabel"),
        "md-chip" to setOf("icon","trailingIcon","label"))[tag].orEmpty()
    return properties.keys().asSequence().associateWith { name->
        val value=properties.get(name)
        when {
            name in booleans->require(value is Boolean) { "$name must be Boolean." }
            name in strings->require(value is String && value.toByteArray().size<=4096) { "$name must be a string of at most 4096 UTF-8 bytes." }
            name=="density"->require(value is Number && value.toDouble() in setOf(0.0,-1.0,-2.0,-3.0,-4.0)) { "Invalid density." }
            tag=="md-chip" && name=="variant"->require(value in setOf("assist","filter","input","suggestion")) { "Invalid variant." }
            tag=="md-chip" && name=="appearance"->require(value in setOf("outlined","filled","elevated")) { "Invalid appearance." }
            tag=="md-chip" && name=="contentAlign"->require(value in setOf("start","center","end")) { "Invalid contentAlign." }
            tag=="md-chip" && name=="color"->require(value is String && value.toByteArray().size<=4096) { "color must be a string." }
            else->throw IllegalArgumentException("Unknown $tag property: $name")
        }
        value
    }
}

/** md-switch / md-checkbox / md-radio methods through the native controller; the resolved value, if any. */
internal fun invokeLivePreviewSelectionMethod(tag:String,request:JSONObject,controller:AWCSelectionControlController):Any? {
    val method=request.optString("method");val args=request.optJSONArray("arguments") ?: JSONArray()
    val methods=mapOf("md-switch" to setOf("setFocus","getValidity","checkValidity","reportValidity","setCustomValidity"),
        "md-checkbox" to setOf("getValidity","checkValidity","reportValidity","setCustomValidity"),
        "md-radio" to setOf("syncValidityFromGroup","getValidity","checkValidity","reportValidity","setCustomValidity","setFocus","setBlur","select"))[tag].orEmpty()
    require(method in methods) { "Unsupported native method." }
    check(controller.isConnected) { "The $tag is not mounted." }
    if(method=="setCustomValidity") {
        require(args.length()==1 && args.get(0) is String && (args.get(0) as String).toByteArray().size<=4096) { "setCustomValidity requires one string of at most 4096 UTF-8 bytes." }
        controller.setCustomValidity(args.getString(0));return null
    }
    require(args.length()==0) { "$method requires no arguments." }
    return when(method) {
        "setFocus"->{ controller.setFocus();null }
        "setBlur"->{ controller.setBlur();null }
        "select"->{ controller.select();null }
        "syncValidityFromGroup"->{ controller.syncValidityFromGroup();null }
        "checkValidity"->controller.checkValidity()
        "reportValidity"->controller.reportValidity()
        else->controller.getValidity().let { v-> JSONObject().put("valid",v.valid).put("validationMessage",v.validationMessage).put("flags",JSONObject(v.flags)) }
    }
}
