package dev.awc.playground

import dev.awc.nativeui.AWCTransferListAppearance
import dev.awc.nativeui.AWCTransferListController
import dev.awc.nativeui.AWCValue
import org.json.JSONArray
import org.json.JSONObject

/** The twenty md-transfer-list hooks from the Laboratory request (defaults, then local values, field by field). */
internal fun parseLivePreviewTransferListAppearance(request:JSONObject):AWCTransferListAppearance {
    fun values(field:String)=request.optJSONObject(field)?.let { o-> o.keys().asSequence().associateWith { o.opt(it).takeUnless { v-> v==JSONObject.NULL } } } ?: emptyMap()
    return AWCTransferListAppearance.of(values("transferListAppearanceDefaults")).merging(AWCTransferListAppearance.of(values("transferListAppearance")))
}

/** Retained md-transfer-list property updates with the source property types. */
internal fun parseLivePreviewTransferListUpdate(request:JSONObject):Map<String,AWCValue> {
    require(request.keys().asSequence().all { it in setOf("command","properties") } && request.optString("command")=="update") { "Expected a Transfer list property update." }
    val properties=request.getJSONObject("properties")
    require(properties.length()>0) { "A property update must contain at least one field." }
    val strings=setOf("sourceTitle","targetTitle","sourceSearchPlaceholder","targetSearchPlaceholder","searchIcon","moveRightIcon","moveLeftIcon","moveAllRightIcon",
        "moveAllLeftIcon","emptyIcon","emptyText","countTemplate","moveRightLabel","moveLeftLabel","moveAllRightLabel","moveAllLeftLabel","selectAllLabel")
    return properties.keys().asSequence().associateWith { name->
        val value=properties.get(name)
        when(name) {
            "items"->require(value is JSONArray || value is String && value.toByteArray().size<=262_144) { "items must be an array of items or its JSON string." }
            "value"->require(value is JSONArray && value.length()<=4096 && (0 until value.length()).all { value.opt(it) is String }) { "value must be an array of strings." }
            "searchable","showSelectAll","disabled","singleStepOnly"->require(value is Boolean) { "$name must be Boolean." }
            "density"->require(value is Number && value.toDouble() in setOf(0.0,-1.0,-2.0,-3.0,-4.0)) { "Invalid density." }
            in strings->require(value is String && value.toByteArray().size<=4096) { "$name must be a string of at most 4096 UTF-8 bytes." }
            else->throw IllegalArgumentException("Unknown md-transfer-list property: $name")
        }
        when(value) { is JSONArray->List(value.length()) { i-> if(name=="value") value.getString(i) else value.opt(i).let { o-> if(o is JSONObject) o.keys().asSequence().associateWith { k-> o.opt(k) } else o } }; else->value }
    }
}

/** md-transfer-list methods through the native controller: moveSelectedRight() / moveSelectedLeft() (no arguments, no result). */
internal fun invokeLivePreviewTransferListMethod(request:JSONObject,controller:AWCTransferListController):JSONArray? {
    val method=request.optString("method");val args=request.optJSONArray("arguments") ?: JSONArray()
    require(method in setOf("moveSelectedRight","moveSelectedLeft")) { "Unsupported md-transfer-list method: $method" }
    require(args.length()==0) { "$method requires no arguments." }
    if(method=="moveSelectedRight") controller.moveSelectedRight() else controller.moveSelectedLeft()
    return null
}
