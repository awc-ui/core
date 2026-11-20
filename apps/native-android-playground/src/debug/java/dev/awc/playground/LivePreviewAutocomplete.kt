package dev.awc.playground

import dev.awc.nativeui.AWCAutocompleteAppearance
import dev.awc.nativeui.AWCAutocompleteController
import dev.awc.nativeui.AWCValue
import org.json.JSONArray
import org.json.JSONObject

/** md-autocomplete in the Laboratory: the eleven typed hooks, retained updates of every source property (except the filterer
 *  closure and the virtualization properties) and the nine methods with results. */
private fun autocompleteValues(request:JSONObject,field:String):Map<String,AWCValue> {
    val obj=request.optJSONObject(field) ?: return emptyMap()
    return obj.keys().asSequence().associateWith { obj.opt(it).takeIf { v-> v!=JSONObject.NULL } }
}
/** Defaults first, local values win (the nearer custom property). */
internal fun parseLivePreviewAutocompleteAppearance(request:JSONObject)=
    AWCAutocompleteAppearance.fromValues(autocompleteValues(request,"autocompleteAppearanceDefaults")).merge(AWCAutocompleteAppearance.fromValues(autocompleteValues(request,"autocompleteAppearance")))

private val autocompleteBooleans=setOf("reserveSupportingSpace","error","disabled","softDisabled","required","multiple","freeSolo","loading","disableCloseOnSelect",
    "clearOnBlur","clearable","open","matchTriggerWidth")
private val autocompleteStrings=setOf("valueMissingLabel","label","placeholder","supportingText","errorText","inputValue","noOptionsText","noResultsText","loadingText",
    "statusTemplate","clearIcon","dropdownIcon","name")
private fun acTextOK(v:Any?)=v is String && v.toByteArray().size<=4096
private val acOptionKeys=setOf("value","label","disabled","supportingText","description","icon","iconColor")
private fun acOptionOK(v:Any?):Boolean = v is JSONObject && v.has("value") && v.keys().asSequence().all { k->
    k in acOptionKeys && v.get(k).let { x-> if(k=="disabled") x is Boolean else acTextOK(x) } }
private fun acOptionsOK(v:Any?)=v is JSONArray && v.length()<=1000 && (0 until v.length()).all { acOptionOK(v.get(it)) }
/** JSON option inits as native values: strings stay strings, objects become maps. */
private fun acOptions(a:JSONArray):List<AWCValue> = (0 until a.length()).map { i-> a.get(i).let { o-> if(o is JSONObject) o.keys().asSequence().associateWith { k-> o.get(k) } else o } }
/** Retained property updates with the source property types. */
internal fun parseLivePreviewAutocompleteUpdate(request:JSONObject):Map<String,AWCValue> {
    require(request.keys().asSequence().all { it in setOf("command","properties") } && request.optString("command")=="update") { "Expected a property update." }
    val properties=request.getJSONObject("properties")
    require(properties.length()>0) { "A property update must contain at least one field." }
    return properties.keys().asSequence().associateWith { name->
        val raw=properties.get(name);val value=if(raw==JSONObject.NULL) null else raw
        when {
            name in autocompleteBooleans->require(value is Boolean) { "$name must be Boolean." }
            name in autocompleteStrings->require(acTextOK(value)) { "$name must be a string of at most 4096 UTF-8 bytes." }
            name=="variant"->require(value in setOf("filled","outlined")) { "Invalid variant." }
            name=="density"->require(value is Number && value.toDouble() in setOf(0.0,-1.0,-2.0,-3.0,-4.0)) { "Invalid density." }
            name=="chipPosition"->require(value in setOf("below","top","left","right","inline")) { "chipPosition must be below, top, left, right or inline." }
            name=="placement"->require(value in setOf("bottom-start","bottom-end","top-start","top-end")) { "Invalid placement." }
            name=="value"->require(acTextOK(value) || value is JSONArray && value.length()<=1000 && (0 until value.length()).all { acTextOK(value.get(it)) }) { "value must be a string or a list of strings." }
            name=="options"->require(acTextOK(value) || acOptionsOK(value)) { "options must be an array of at most 1000 options." }
            name in setOf("maxSelected","limitResults")->require(value is Number && value.toDouble()>=0 && value.toDouble()==Math.floor(value.toDouble())) { "$name must be a non-negative integer." }
            name=="maxHeight"->require(value==null || value is Number && value.toDouble().isFinite() && value.toDouble()>=0) { "maxHeight must be a non-negative number or null." }
            else->throw IllegalArgumentException("Unknown md-autocomplete property: $name")
        }
        when(value) { is Number->value.toDouble(); is JSONArray->if(name=="options") acOptions(value) else (0 until value.length()).map { value.getString(it) }; else->value }
    }
}

/** focusInput / showMenu / closeMenu / loadOptions / getLabels / getValidity / checkValidity / reportValidity / setCustomValidity. */
internal fun invokeLivePreviewAutocompleteMethod(request:JSONObject,controller:AWCAutocompleteController):Any? {
    val method=request.optString("method");val args=request.optJSONArray("arguments") ?: JSONArray()
    require(method in setOf("focusInput","showMenu","closeMenu","loadOptions","getLabels","getValidity","checkValidity","reportValidity","setCustomValidity")) { "Unsupported native method." }
    check(controller.isConnected) { "The md-autocomplete is not mounted." }
    when(method) {
        "setCustomValidity"->{ require(args.length()==1 && acTextOK(args.get(0))) { "setCustomValidity requires one string of at most 4096 UTF-8 bytes." }
            controller.setCustomValidity(args.getString(0));return null }
        "loadOptions"->{ require(args.length()==1 && acOptionsOK(args.get(0))) { "loadOptions requires one array of at most 1000 options." }
            controller.loadOptions(acOptions(args.getJSONArray(0)));return null }
        "getLabels"->{ val a=args.optJSONArray(0)
            require(args.length()==1 && a!=null && a.length()<=1000 && (0 until a.length()).all { acTextOK(a.get(it)) }) { "getLabels requires one array of at most 1000 value strings." }
            // A labels map travels in its own envelope (a bare object is the validity record).
            return JSONObject().put("awcAutocompleteLabels",JSONObject(controller.getLabels((0 until a.length()).map { a.getString(it) }))) }
    }
    require(args.length()==0) { "$method requires no arguments." }
    return when(method) {
        "focusInput"->{ controller.focusInput();null }
        "showMenu"->{ controller.showMenu();null }
        "closeMenu"->{ controller.closeMenu();null }
        "checkValidity"->controller.checkValidity()
        "reportValidity"->controller.reportValidity()
        else->controller.getValidity().let { v-> JSONObject().put("valid",v.valid).put("validationMessage",v.validationMessage).put("flags",JSONObject(v.flags)) }
    }
}
