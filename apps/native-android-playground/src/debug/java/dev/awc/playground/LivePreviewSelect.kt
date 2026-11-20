package dev.awc.playground

import dev.awc.nativeui.AWCMultiSelectAppearance
import dev.awc.nativeui.AWCMultiSelectController
import dev.awc.nativeui.AWCSelectAppearance
import dev.awc.nativeui.AWCSelectController
import dev.awc.nativeui.AWCValue
import org.json.JSONArray
import org.json.JSONObject

/** md-select / md-multi-select in the Laboratory: typed hooks (eight / thirty-eight), retained updates of every supported source
 *  property and the controller methods (show, close, focusTrigger, reset, loadOptions, setQuery, getLabels and validity). */
internal val livePreviewSelectTags=setOf("md-select","md-multi-select")
private fun selectValues(request:JSONObject,field:String):Map<String,AWCValue> {
    val obj=request.optJSONObject(field) ?: return emptyMap()
    return obj.keys().asSequence().associateWith { obj.opt(it).takeIf { v-> v!=JSONObject.NULL } }
}
/** Defaults first, local values win (the nearer custom property). */
internal fun parseLivePreviewSelectAppearance(request:JSONObject)=
    AWCSelectAppearance.fromValues(selectValues(request,"selectAppearanceDefaults")).merge(AWCSelectAppearance.fromValues(selectValues(request,"selectAppearance")))
internal fun parseLivePreviewMultiSelectAppearance(request:JSONObject)=
    AWCMultiSelectAppearance.fromValues(selectValues(request,"multiSelectAppearanceDefaults")).merge(AWCMultiSelectAppearance.fromValues(selectValues(request,"multiSelectAppearance")))

private val selectBooleans=setOf("reserveSupportingSpace","disabled","softDisabled","required","error","clearable","matchTriggerWidth","filterable","loading","fullWidth","open","showSelectAll")
private val selectStrings=setOf("valueMissingLabel","label","placeholder","errorText","supportingText","name","searchPlaceholder","filterLabel","noResultsText",
    "noOptionsText","clearLabel","loadingText","clearIcon","dropdownIcon","selectAllLabel","triggerIcon","triggerLabel")
private val selectProperties=setOf("valueMissingLabel","reserveSupportingSpace","variant","label","placeholder","value","disabled","required","error","errorText",
    "supportingText","density","clearable","matchTriggerWidth","placement","maxHeight","options","filterable","name","searchPlaceholder","filterLabel","noResultsText",
    "noOptionsText","clearLabel","loadingText","clearIcon","dropdownIcon","loading","fullWidth","open")
private val multiSelectProperties=setOf("valueMissingLabel","reserveSupportingSpace","variant","label","placeholder","supportingText","error","errorText","disabled",
    "softDisabled","required","density","options","filterable","value","maxSelected","showSelectAll","selectAllLabel","placement","maxHeight","matchTriggerWidth",
    "displayMode","chipOverflow","chipPosition","trigger","triggerIcon","triggerLabel","searchPlaceholder","filterLabel","noResultsText","noOptionsText","loadingText",
    "loading","clearable","clearIcon","clearLabel","dropdownIcon","name","open")
private fun textOK(v:Any?,limit:Int=4096)=v is String && v.toByteArray().size<=limit
private val optionKeys=setOf("value","label","disabled","icon","iconColor","supportingText","selected","hidden")
/** SelectOptionInit[] (≤ 500 objects with a string value) → native option maps; null when malformed. */
internal fun livePreviewSelectOptions(raw:Any?):List<Map<String,Any?>>? {
    val array=raw as? JSONArray ?: return null
    if(array.length()>500) return null
    return (0 until array.length()).map { i->
        val o=array.opt(i) as? JSONObject ?: return null
        if(!o.keys().asSequence().all { it in optionKeys } || !textOK(o.opt("value"),1024)) return null
        if(o.has("label") && !textOK(o.opt("label"))) return null
        if(listOf("disabled","selected","hidden").any { o.has(it) && o.opt(it) !is Boolean }) return null
        if(listOf("icon","iconColor","supportingText").any { o.has(it) && !textOK(o.opt(it)) }) return null
        o.keys().asSequence().associateWith { o.opt(it) }
    }
}
/** Retained property updates with the source property types (virtualize / filterMode / rowHeight / searchingLabel and the
 *  countFormatter closure are not supported natively; the support policies list them). */
internal fun parseLivePreviewSelectUpdate(request:JSONObject,tag:String):Map<String,AWCValue> {
    require(request.keys().asSequence().all { it in setOf("command","properties") } && request.optString("command")=="update") { "Expected a property update." }
    val properties=request.getJSONObject("properties")
    require(properties.length()>0) { "A property update must contain at least one field." }
    val declared=if(tag=="md-multi-select") multiSelectProperties else selectProperties
    return properties.keys().asSequence().associateWith { name->
        require(name in declared) { "Unknown $tag property: $name" }
        val raw=properties.get(name);val value=if(raw==JSONObject.NULL) null else raw
        when {
            name in selectBooleans->require(value is Boolean) { "$name must be Boolean." }
            name in selectStrings->require(textOK(value)) { "$name must be a string of at most 4096 UTF-8 bytes." }
            name=="variant"->require(value in setOf("filled","outlined")) { "Invalid variant." }
            name=="density"->require(value is Number && value.toDouble() in setOf(0.0,-1.0,-2.0,-3.0,-4.0)) { "Invalid density." }
            name=="placement"->require(value in setOf("bottom-start","bottom-end","top-start","top-end")) { "Invalid placement." }
            name=="displayMode"->require(value in setOf("chips","chips-inline","count","text")) { "Invalid displayMode." }
            name=="chipOverflow"->require(value in setOf("count","wrap")) { "Invalid chipOverflow." }
            name=="chipPosition"->require(value in setOf("bottom","top","left","right")) { "Invalid chipPosition." }
            name=="trigger"->require(value in setOf("field","button")) { "Invalid trigger." }
            name=="maxSelected"->require(value is Number && value.toDouble().let { it>=0 && it<=1e6 && it==Math.floor(it) }) { "maxSelected must be a nonnegative integer." }
            name=="maxHeight"->require(value==null || value is Number && value.toDouble().let { it.isFinite() && it>=0 && it<=1e5 } || tag=="md-select" && textOK(value)) { "Invalid maxHeight." }
            name=="options"->require(textOK(value,65536) || livePreviewSelectOptions(value)!=null) { "options must be an array of at most 500 options or JSON text." }
            name=="value"->if(tag=="md-multi-select") require(value is JSONArray && value.length()<=500 && (0 until value.length()).all { textOK(value.opt(it),1024) }) { "value must be an array of at most 500 strings." }
                else require(textOK(value)) { "value must be a string." }
        }
        when(value) { is Number->value.toDouble(); is JSONArray->if(name=="options") livePreviewSelectOptions(value) else (0 until value.length()).map { value.getString(it) }; else->value }
    }
}
private fun validityJSON(valid:Boolean,message:String,flags:Map<String,Boolean>)=JSONObject().put("valid",valid).put("validationMessage",message).put("flags",JSONObject(flags))
/** The controller methods; getLabels answers { awcSelectLabels: { value: label } }. */
internal fun invokeLivePreviewSelectMethod(tag:String,request:JSONObject,select:AWCSelectController,multi:AWCMultiSelectController):Any? {
    val method=request.optString("method");val args=request.optJSONArray("arguments") ?: JSONArray()
    require(method in setOf("show","close","focusTrigger","reset","loadOptions","setQuery","getLabels","getValidity","checkValidity","reportValidity","setCustomValidity")) { "Unsupported native method." }
    val connected=if(tag=="md-multi-select") multi.isConnected else select.isConnected
    check(connected) { "The $tag is not mounted." }
    fun one():Any? { require(args.length()==1) { "$method requires one argument." };return args.get(0) }
    return when(method) {
        "setCustomValidity","setQuery"->{ val text=one();require(textOK(text)) { "$method requires one string of at most 4096 UTF-8 bytes." }
            if(method=="setQuery") { if(tag=="md-multi-select") multi.setQuery(text as String) else select.setQuery(text as String) }
            else { if(tag=="md-multi-select") multi.setCustomValidity(text as String) else select.setCustomValidity(text as String) };null }
        "loadOptions"->{ val options=livePreviewSelectOptions(one());requireNotNull(options) { "loadOptions requires one array of at most 500 options." }
            if(tag=="md-multi-select") multi.loadOptions(options) else select.loadOptions(options);null }
        "getLabels"->{ val values=one() as? JSONArray;require(values!=null && values.length()<=500 && (0 until values.length()).all { textOK(values.opt(it),1024) }) { "getLabels requires one array of at most 500 value strings." }
            val list=(0 until values!!.length()).map { values.getString(it) }
            JSONObject().put("awcSelectLabels",JSONObject(if(tag=="md-multi-select") multi.getLabels(list) else select.getLabels(list))) }
        else->{ require(args.length()==0) { "$method requires no arguments." }
            when(method) {
                "show"->{ if(tag=="md-multi-select") multi.show() else select.show();null }
                "close"->{ if(tag=="md-multi-select") multi.close() else select.close();null }
                "focusTrigger"->{ if(tag=="md-multi-select") multi.focusTrigger() else select.focusTrigger();null }
                "reset"->{ if(tag=="md-multi-select") multi.reset() else select.reset();null }
                "checkValidity"->if(tag=="md-multi-select") multi.checkValidity() else select.checkValidity()
                "reportValidity"->if(tag=="md-multi-select") multi.reportValidity() else select.reportValidity()
                else->(if(tag=="md-multi-select") multi.getValidity() else select.getValidity()).let { v-> validityJSON(v.valid,v.validationMessage,v.flags) }
            } }
    }
}
