package dev.awc.playground

import dev.awc.nativeui.AWCRippleAppearance
import dev.awc.nativeui.AWCRippleController
import dev.awc.nativeui.AWCValue
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeoutOrNull
import org.json.JSONArray
import org.json.JSONObject

/** md-ripple in the Laboratory: typed hooks, the retained `disabled` update and trigger()/whenSettled(). */
private fun rippleValues(request:JSONObject,field:String):Map<String,Any?> {
    val obj=request.optJSONObject(field) ?: return emptyMap()
    return obj.keys().asSequence().associateWith { obj.opt(it).takeIf { v-> v!=JSONObject.NULL } }
}
/** Defaults first, local values win (the nearer custom property). */
internal fun parseLivePreviewRippleAppearance(request:JSONObject)=AWCRippleAppearance.fromValues(rippleValues(request,"rippleAppearanceDefaults")).merging(AWCRippleAppearance.fromValues(rippleValues(request,"rippleAppearance")))

internal fun parseLivePreviewRippleUpdate(request:JSONObject):Map<String,AWCValue> {
    require(request.keys().asSequence().all { it in setOf("command","properties") } && request.optString("command")=="update") { "Expected a property update." }
    val properties=request.getJSONObject("properties")
    require(properties.length()>0) { "A property update must contain at least one field." }
    return properties.keys().asSequence().associateWith { name->
        val value=properties.get(name)
        require(name=="disabled") { "Unknown md-ripple property: $name" }
        require(value is Boolean) { "disabled must be Boolean." }
        value
    }
}

/** trigger() starts a centred, self-releasing wave; whenSettled() returns once the cycle settles (source bound 200 ms). */
internal fun invokeLivePreviewRippleMethod(request:JSONObject,controller:AWCRippleController):Any? {
    val method=request.optString("method");val args=request.optJSONArray("arguments") ?: JSONArray()
    require(method in setOf("trigger","whenSettled")) { "Unsupported native method." }
    require(args.length()==0) { "$method requires no arguments." }
    if(method=="trigger") controller.trigger() else runBlocking { withTimeoutOrNull(1000) { controller.whenSettled() } }
    return null
}
