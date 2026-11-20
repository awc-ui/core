package dev.awc.playground

import dev.awc.nativeui.AWCSearchAppearance
import dev.awc.nativeui.AWCSearchController
import dev.awc.nativeui.AWCValue
import org.json.JSONArray
import org.json.JSONObject

/** md-search in the Laboratory: the sixty typed hooks, retained updates of every source property and the controller methods. */
private fun searchJSON(v:Any?):Any? = when(v) {
    null,JSONObject.NULL->null
    is JSONArray->(0 until v.length()).map { searchJSON(v.get(it)) }
    is JSONObject->v.keys().asSequence().associateWith { searchJSON(v.get(it)) }
    is Number->v.toDouble()
    else->v
}
private fun searchValues(request:JSONObject,field:String):Map<String,AWCValue> {
    val obj=request.optJSONObject(field) ?: return emptyMap()
    return obj.keys().asSequence().associateWith { searchJSON(obj.opt(it)) }
}
/** Defaults first, local values win (the nearer custom property). */
internal fun parseLivePreviewSearchAppearance(request:JSONObject)=
    AWCSearchAppearance.fromValues(searchValues(request,"searchAppearanceDefaults")).merged(AWCSearchAppearance.fromValues(searchValues(request,"searchAppearance")))

private val searchBooleans=setOf("fullWidth","open","disabled","showClearButton","voiceSearch","escapeCloses","dismissOnOutsideClick","scrollShadow","announceResults","loading")
private val searchStrings=setOf("triggerIcon","triggerFor","value","placeholder","leadingIcon","openLeadingIcon","maxBlockSize","inputAriaLabel","resultsLabel","noResultsLabel","loadingLabel")
private val searchEnums=mapOf("variant" to setOf("contained","divided"),"layout" to setOf("full-screen","docked"),"trigger" to setOf("","bar","icon"),"initialFocus" to setOf("auto","input","leading"))
/** Retained property updates with the source property types (triggerElement is a DOM reference: no native counterpart). */
internal fun parseLivePreviewSearchUpdate(request:JSONObject):Map<String,AWCValue> {
    require(request.keys().asSequence().all { it in setOf("command","properties") } && request.optString("command")=="update") { "Expected a property update." }
    val properties=request.getJSONObject("properties")
    require(properties.length()>0) { "A property update must contain at least one field." }
    return properties.keys().asSequence().associateWith { name->
        val raw=properties.get(name);val value=if(raw==JSONObject.NULL) null else raw
        when {
            name in searchBooleans->require(value is Boolean) { "$name must be Boolean." }
            name in searchStrings->require(value is String && value.toByteArray().size<=4096) { "$name must be a string of at most 4096 UTF-8 bytes." }
            name in searchEnums->require(value in searchEnums.getValue(name)) { "Invalid $name." }
            name=="elevation"->require(value is Number && value.toDouble() in setOf(0.0,1.0,2.0,3.0,4.0,5.0)) { "Invalid elevation." }
            name=="density"->require(value is Number && value.toDouble() in setOf(0.0,-1.0,-2.0,-3.0,-4.0)) { "Invalid density." }
            name=="debounce" || name=="throttle"->require(value is Number && value.toDouble().let { it.isFinite() && it>=0 && it<=1e6 }) { "Invalid $name." }
            else->throw IllegalArgumentException("Unknown md-search property: $name")
        }
        if(value is Number) value.toDouble() else value
    }
}

/** show / close / toggle / focusInput through the native controller (whenClosed and the voice methods are native API only). */
internal fun invokeLivePreviewSearchMethod(request:JSONObject,controller:AWCSearchController):Any? {
    val method=request.optString("method");val args=request.optJSONArray("arguments") ?: JSONArray()
    require(method in setOf("show","close","toggle","focusInput")) { "Unsupported native method." }
    require(args.length()==0) { "$method requires no arguments." }
    check(controller.isConnected) { "The md-search is not mounted." }
    when(method) { "show"->controller.show();"close"->controller.close();"toggle"->controller.toggle();else->controller.focusInput() }
    return null
}
