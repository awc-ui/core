package dev.awc.playground

import dev.awc.nativeui.AWCProgressIndicatorAppearance
import dev.awc.nativeui.AWCValue
import org.json.JSONObject

internal fun parseLivePreviewProgressAppearance(request:JSONObject,field:String):AWCProgressIndicatorAppearance {
    fun value(input:Any?):Any?=when(input) {
        is JSONObject -> input.keys().asSequence().associateWith { value(input.opt(it)) }
        JSONObject.NULL -> null
        else -> input
    }
    val values=request.optJSONObject(field) ?: return AWCProgressIndicatorAppearance()
    return AWCProgressIndicatorAppearance.fromValues(values.keys().asSequence().associateWith { value(values.opt(it)) })
}

/** This is a retained Laboratory transport operation, not a component method. */
internal fun parseLivePreviewProgressUpdate(request:JSONObject):Map<String,AWCValue> {
    require(request.keys().asSequence().all { it in setOf("command","properties") }) { "Unexpected property update field." }
    require(request.optString("command")=="update") { "Expected a property update." }
    val properties=request.getJSONObject("properties")
    require(properties.length()>0) { "A property update must contain at least one field." }
    val numbers=setOf("value","max","thickness","waveAmplitude","waveLength","waveSpeed","size")
    val flags=setOf("indeterminate","wave","fourColor","complete")
    return properties.keys().asSequence().associateWith { name ->
        val value=properties.get(name)
        when {
            name in numbers -> require(value is Number && value.toDouble().isFinite()) { "$name must be finite." }
            name in flags -> require(value is Boolean) { "$name must be Boolean." }
            name=="variant" -> require(value is String && value in setOf("linear","circular")) { "Invalid progress variant." }
            name=="density" -> require(value is Number && value.toDouble() in setOf(0.0,-1.0,-2.0,-3.0,-4.0)) { "Invalid progress density." }
            name=="label" -> require(value is String && value.toByteArray(Charsets.UTF_8).size<=4096) { "Invalid progress label." }
            else -> throw IllegalArgumentException("Unknown progress property: $name")
        }
        value
    }
}
