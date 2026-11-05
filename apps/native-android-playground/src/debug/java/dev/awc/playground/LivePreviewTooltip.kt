package dev.awc.playground

import dev.awc.nativeui.AWCTooltipAppearance
import dev.awc.nativeui.AWCValue
import org.json.JSONArray
import org.json.JSONObject

internal fun parseLivePreviewTooltipAppearance(request:JSONObject,field:String):AWCTooltipAppearance {
    fun value(input:Any?,depth:Int=0):Any?=if(depth>8) null else when(input) {
        is JSONObject->input.keys().asSequence().associateWith { value(input.opt(it),depth+1) }
        JSONObject.NULL->null
        else->input
    }
    val obj=request.optJSONObject(field) ?: return AWCTooltipAppearance()
    return AWCTooltipAppearance.fromValues(obj.keys().asSequence().associateWith { value(obj.opt(it)) })
}
internal fun parseLivePreviewTooltipMethod(method:String,args:JSONArray):List<String> {
    require(method in setOf("show","hide") && args.length()==0) { "Tooltip show/hide take no arguments." }
    return emptyList()
}
internal fun parseLivePreviewTooltipUpdate(request:JSONObject):Map<String,AWCValue> {
    require(request.keys().asSequence().all { it in setOf("command","properties") } && request.optString("command")=="update") { "Expected a Tooltip property update." }
    val properties=request.getJSONObject("properties")
    require(properties.length()>0) { "A property update must contain at least one field." }
    return properties.keys().asSequence().associateWith { name->
        val value=properties.get(name)
        when(name) {
            "open","disabled","autoPosition"->require(value is Boolean) { "Tooltip flags must be Boolean." }
            "text","subhead"->require(value is String && value.toByteArray(Charsets.UTF_8).size<=4096) { "Invalid Tooltip string." }
            "variant"->require(value is String && value in setOf("plain","rich")) { "Invalid Tooltip variant." }
            "position"->require(value is String && value in listOf("top","bottom","left","right").flatMap { listOf(it,"$it-start","$it-end") }) { "Invalid Tooltip position." }
            "offset","crossOffset","showDelay","hideDelay"->require(value is Number && value.toDouble().isFinite()) { "Tooltip numeric properties must be finite." }
            "density"->require(value is Number && value.toDouble() in setOf(0.0,-1.0,-2.0,-3.0,-4.0)) { "Invalid Tooltip density." }
            else->throw IllegalArgumentException("Unknown Tooltip property: $name")
        }
        value
    }
}
