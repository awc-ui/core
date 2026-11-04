package dev.awc.playground

import dev.awc.nativeui.AWCCardAppearance
import dev.awc.nativeui.AWCValue
import org.json.JSONArray
import org.json.JSONObject

/** Typed md-card appearance from the Laboratory request (lengths, insets, corners and shadow lists stay structured). */
internal fun parseLivePreviewCardAppearance(request:JSONObject,field:String):AWCCardAppearance {
    fun value(input:Any?,depth:Int=0):Any?=if(depth>8) null else when(input) {
        is JSONObject->input.keys().asSequence().associateWith { value(input.opt(it),depth+1) }
        is JSONArray->List(input.length()) { value(input.opt(it),depth+1) }
        JSONObject.NULL->null
        else->input
    }
    val obj=request.optJSONObject(field) ?: return AWCCardAppearance()
    return AWCCardAppearance.fromValues(obj.keys().asSequence().associateWith { value(obj.opt(it)) })
}

/** Retained md-card property updates with the source property types. */
internal fun parseLivePreviewCardUpdate(request:JSONObject):Map<String,AWCValue> {
    require(request.keys().asSequence().all { it in setOf("command","properties") } && request.optString("command")=="update") { "Expected a Card property update." }
    val properties=request.getJSONObject("properties")
    require(properties.length()>0) { "A property update must contain at least one field." }
    val booleans=setOf("interactive","dragEnabled","disabled","softDisabled","ripple","fullWidth","fullHeight")
    return properties.keys().asSequence().associateWith { name->
        val value=properties.get(name)
        when(name) {
            in booleans->require(value is Boolean) { "$name must be Boolean." }
            "variant"->require(value is String && value in setOf("elevated","filled","outlined")) { "Invalid variant." }
            "density"->require(value is Number && value.toDouble() in setOf(0.0,-1.0,-2.0,-3.0,-4.0)) { "Invalid density." }
            else->throw IllegalArgumentException("Unknown md-card property: $name")
        }
        value
    }
}
