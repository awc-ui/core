package dev.awc.playground

import dev.awc.nativeui.AWCValue
import org.json.JSONArray
import org.json.JSONObject

/**
 * Retained Laboratory updates for md-badge, md-loading-indicator, md-meter and md-status-dot (gate-7 R2-D6).
 * This is a transport operation, not a component method: the mounted root keeps its state, so the source's
 * property-change behaviour (meter value glide, status-dot colour transition, continuous loading morph) stays visible.
 * md-meter formatOptions: null means absent (localized percentage of the range); an object is passed as a map.
 */
internal fun parseLivePreviewCommunicationUpdate(tag:String,request:JSONObject):Map<String,AWCValue> {
    require(request.keys().asSequence().all { it in setOf("command","properties") }) { "Unexpected property update field." }
    require(request.optString("command")=="update") { "Expected a property update." }
    val properties=request.getJSONObject("properties")
    require(properties.length()>0) { "A property update must contain at least one field." }
    val declared=mapOf(
        "md-badge" to setOf("variant","value","max","icon","shape","density"),
        "md-loading-indicator" to setOf("variant","label","density"),
        "md-meter" to setOf("value","min","max","label","showLabel","showValue","valueText","locale","formatOptions","color","variant","size","thickness","density"),
        "md-status-dot" to setOf("state","size","inline","shape","live","label","density"))
    fun text(v:Any?)=v is String && v.toByteArray(Charsets.UTF_8).size<=4096
    fun finite(v:Any?)=v is Number && v.toDouble().isFinite()
    fun plain(v:Any?):Any?=when(v) {
        is JSONObject -> v.keys().asSequence().associateWith { plain(v.opt(it)) }
        is JSONArray -> (0 until v.length()).map { plain(v.opt(it)) }
        JSONObject.NULL -> null
        else -> v
    }
    return properties.keys().asSequence().associateWith { name ->
        require(name in declared.getValue(tag)) { "Unknown $tag property: $name" }
        val value=properties.get(name)
        val ok=when {
            name=="density" -> value is Number && value.toDouble() in setOf(0.0,-1.0,-2.0,-3.0,-4.0)
            tag=="md-badge" && name=="variant" -> value in setOf("small","large")
            name=="shape" -> value in setOf("rect","circle")
            tag=="md-loading-indicator" && name=="variant" -> value in setOf("uncontained","contained")
            tag=="md-meter" && name=="variant" -> value in setOf("linear","circular")
            tag=="md-status-dot" && name=="state" -> value in setOf("online","away","busy","offline","invisible","neutral")
            tag=="md-status-dot" && name=="size" -> value in setOf("small","medium","large")
            name in setOf("inline","live","showLabel","showValue") -> value is Boolean
            tag=="md-badge" && name=="max" -> finite(value)
            tag=="md-meter" && name in setOf("value","min","max","size","thickness") -> finite(value)
            name=="formatOptions" -> value is JSONObject || value==JSONObject.NULL
            else -> text(value)
        }
        require(ok) { "Invalid $tag $name." }
        plain(value)
    }
}
