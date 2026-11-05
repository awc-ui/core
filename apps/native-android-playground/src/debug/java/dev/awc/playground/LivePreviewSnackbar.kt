package dev.awc.playground

import dev.awc.nativeui.AWCSnackbarAppearance
import dev.awc.nativeui.AWCValue
import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.*

internal fun parseLivePreviewSnackbarHeight(request:JSONObject,tag:String,width:Double):Double {
    if(!request.has("height")) return 240.0.coerceAtMost(min(2000.0,floor(2_000_000/width)))
    require(tag in setOf("md-snackbar","md-tooltip","md-dialog","md-bottom-sheet","md-side-sheet","md-time-picker","md-color-picker")) { "Configured height requires a native viewport component." }
    val raw=request.get("height")
    require(raw is Number && raw.toDouble().isFinite() && raw.toDouble()>0) { "Native height must be finite and positive." }
    return floor(raw.toDouble().coerceIn(1.0,min(2000.0,floor(2_000_000/width)))+.5)
}
internal fun parseLivePreviewSnackbarAppearance(request:JSONObject,field:String):AWCSnackbarAppearance {
    fun value(input:Any?,depth:Int=0):Any?=if(depth>8) null else when(input) {
        is JSONObject->input.keys().asSequence().associateWith { value(input.opt(it),depth+1) }
        JSONObject.NULL->null
        else->input
    }
    val objectValue=request.optJSONObject(field) ?: return AWCSnackbarAppearance()
    return AWCSnackbarAppearance.fromValues(objectValue.keys().asSequence().associateWith { value(objectValue.opt(it)) })
}
internal fun parseLivePreviewSnackbarMethod(method:String,args:JSONArray):List<String> {
    require(method in setOf("show","hide")) { "Unknown Snackbar method." }
    require(args.length()==0 || method=="hide" && args.length()==1 && args.get(0) is String && args.getString(0) in setOf("auto","action","close")) { "Invalid Snackbar method arguments." }
    return (0 until args.length()).map { args.getString(it) }
}
internal fun parseLivePreviewSnackbarUpdate(request:JSONObject):Map<String,AWCValue> {
    require(request.keys().asSequence().all { it in setOf("command","properties") }) { "Unexpected property update field." }
    require(request.optString("command")=="update") { "Expected a property update." }
    val properties=request.getJSONObject("properties")
    require(properties.length()>0) { "A property update must contain at least one field." }
    return properties.keys().asSequence().associateWith { name->
        val value=properties.get(name)
        when(name) {
            "open","closeable","autoHide","stacked"->require(value is Boolean) { "Snackbar flag must be Boolean." }
            "message","action","dismissLabel"->require(value is String && value.toByteArray(Charsets.UTF_8).size<=4096) { "Invalid Snackbar string." }
            "position"->require(value is String && value in setOf("bottom","bottom-start","bottom-end","top","top-start","top-end","start","end","center")) { "Invalid Snackbar position." }
            "politeness"->require(value is String && value in setOf("polite","assertive")) { "Invalid Snackbar politeness." }
            "autoHideDuration"->require(value is Number && value.toDouble().isFinite()) { "Snackbar duration must be finite." }
            "density"->require(value is Number && value.toDouble() in setOf(0.0,-1.0,-2.0,-3.0,-4.0)) { "Invalid Snackbar density." }
            else->throw IllegalArgumentException("Unknown Snackbar property: $name")
        }
        value
    }
}

internal fun parseLivePreviewSnackbarResize(request:JSONObject):Pair<Double,Double> {
    require(request.keys().asSequence().toSet()==setOf("command","width","height") && request.optString("command")=="resize") { "Expected Snackbar viewport dimensions only." }
    val raw=request.get("width")
    require(raw is Number && raw.toDouble().isFinite() && raw.toDouble()>0) { "Native width must be finite and positive." }
    val width=floor(raw.toDouble().coerceIn(320.0,1200.0)+.5)
    return width to parseLivePreviewSnackbarHeight(request,"md-snackbar",width)
}
