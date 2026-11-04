package dev.awc.playground

import dev.awc.nativeui.AWCOrgChartAppearance
import dev.awc.nativeui.AWCValue
import org.json.JSONArray
import org.json.JSONObject

/** The fifteen md-organization-chart hooks from the Laboratory request (defaults, then local values, field by field). */
internal fun parseLivePreviewOrgChartAppearance(request:JSONObject):AWCOrgChartAppearance {
    fun values(field:String)=request.optJSONObject(field)?.let { o-> o.keys().asSequence().associateWith { o.opt(it).takeUnless { v-> v==JSONObject.NULL } } } ?: emptyMap()
    return AWCOrgChartAppearance.of(values("orgChartAppearanceDefaults")).merging(AWCOrgChartAppearance.of(values("orgChartAppearance")))
}

/** Retained md-organization-chart property updates with the source property types. */
internal fun parseLivePreviewOrgChartUpdate(request:JSONObject):Map<String,AWCValue> {
    require(request.keys().asSequence().all { it in setOf("command","properties") } && request.optString("command")=="update") { "Expected an Organization chart property update." }
    val properties=request.getJSONObject("properties")
    require(properties.length()>0) { "A property update must contain at least one field." }
    return properties.keys().asSequence().associateWith { name->
        val value=properties.get(name)
        when(name) {
            "nodes"->require(value is JSONArray || value is JSONObject || value is String && value.toByteArray().size<=262_144) { "nodes must be an array or object of nodes, or their JSON string." }
            "selectedIds"->require(value is JSONArray && value.length()<=4096 && (0 until value.length()).all { value.opt(it) is String }) { "selectedIds must be an array of strings." }
            "collapsible"->require(value is Boolean) { "collapsible must be Boolean." }
            "selectionMode"->require(value is String && value in setOf("none","single","multiple")) { "Invalid selectionMode." }
            "orientation"->require(value is String && value in setOf("vertical","horizontal")) { "Invalid orientation." }
            "label","expandLabel","collapseLabel"->require(value is String && value.toByteArray().size<=4096) { "$name must be a string of at most 4096 UTF-8 bytes." }
            "density"->require(value is Number && value.toDouble() in setOf(0.0,-1.0,-2.0,-3.0,-4.0)) { "Invalid density." }
            else->throw IllegalArgumentException("Unknown md-organization-chart property: $name")
        }
        when(value) { is JSONArray->List(value.length()) { i-> if(name=="selectedIds") value.getString(i) else value.opt(i) }; else->value }
    }
}
