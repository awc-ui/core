package dev.awc.playground

import dev.awc.nativeui.AWCAvatarAppearance
import dev.awc.nativeui.AWCValue
import org.json.JSONArray
import org.json.JSONObject

/** Typed md-avatar appearance from the Laboratory request (lengths and corners stay structured). */
internal fun parseLivePreviewAvatarAppearance(request:JSONObject,field:String):AWCAvatarAppearance {
    fun value(input:Any?,depth:Int=0):Any?=if(depth>8) null else when(input) {
        is JSONObject->input.keys().asSequence().associateWith { value(input.opt(it),depth+1) }
        is JSONArray->List(input.length()) { value(input.opt(it),depth+1) }
        JSONObject.NULL->null
        else->input
    }
    val obj=request.optJSONObject(field) ?: return AWCAvatarAppearance()
    return AWCAvatarAppearance.fromValues(obj.keys().asSequence().associateWith { value(obj.opt(it)) })
}

/** Retained md-avatar property updates with the source property types. */
internal fun parseLivePreviewAvatarUpdate(request:JSONObject):Map<String,AWCValue> {
    require(request.keys().asSequence().all { it in setOf("command","properties") } && request.optString("command")=="update") { "Expected an Avatar property update." }
    val properties=request.getJSONObject("properties")
    require(properties.length()>0) { "A property update must contain at least one field." }
    val strings=setOf("src","alt","name","initials","label")
    return properties.keys().asSequence().associateWith { name->
        val value=properties.get(name)
        when(name) {
            in strings->require(value is String && value.toByteArray().size<=4096) { "$name must be a string of at most 4096 UTF-8 bytes." }
            "size"->require(value is String && value.toByteArray().size<=4096 || value is Number && value.toDouble().isFinite()) { "size must be a preset, a CSS length or a finite number." }
            "shape"->require(value is String && value in setOf("circle","rounded","square")) { "Invalid shape." }
            "colorFromName"->require(value is Boolean) { "colorFromName must be Boolean." }
            "loading"->require(value is String && value in setOf("eager","lazy")) { "Invalid loading." }
            "crossorigin"->require(value is String && value in setOf("","anonymous","use-credentials")) { "Invalid crossorigin." }
            "density"->require(value is Number && value.toDouble() in setOf(0.0,-1.0,-2.0,-3.0,-4.0)) { "Invalid density." }
            else->throw IllegalArgumentException("Unknown md-avatar property: $name")
        }
        value
    }
}
