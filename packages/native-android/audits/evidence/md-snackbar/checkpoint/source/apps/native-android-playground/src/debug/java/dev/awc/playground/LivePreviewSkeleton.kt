package dev.awc.playground

import dev.awc.nativeui.AWCValue
import org.json.JSONObject

/** Retained Laboratory edits preserve the mounted Skeleton entrance lifetime. */
internal fun parseLivePreviewSkeletonUpdate(request:JSONObject):Map<String,AWCValue> {
    require(request.keys().asSequence().all { it in setOf("command","properties") }) { "Unexpected property update field." }
    require(request.optString("command")=="update") { "Expected a property update." }
    val properties=request.getJSONObject("properties")
    require(properties.length()>0) { "A property update must contain at least one field." }
    return properties.keys().asSequence().associateWith { name->
        val value=properties.get(name)
        when(name) {
            "variant"->require(value is String && value in setOf("text","rectangular","rounded","circular")) { "Invalid Skeleton variant." }
            "animation"->require(value is String && value in setOf("none","pulse","wave")) { "Invalid Skeleton animation." }
            "lines"->require(value is Number && value.toDouble().isFinite()) { "Skeleton lines must be finite." }
            "density"->require(value is Number && value.toDouble() in setOf(0.0,-1.0,-2.0,-3.0,-4.0)) { "Invalid Skeleton density." }
            "width","height","ariaLabelProp"->require(value is String && value.toByteArray(Charsets.UTF_8).size<=4096) { "Invalid Skeleton string." }
            "fullWidth","fullHeight","announce"->require(value is Boolean) { "Skeleton flag must be Boolean." }
            else->throw IllegalArgumentException("Unknown Skeleton property: $name")
        }
        value
    }
}
