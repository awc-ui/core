package dev.awc.playground

import dev.awc.nativeui.AWCBreadcrumbsAppearance
import dev.awc.nativeui.AWCBreadcrumbsController
import dev.awc.nativeui.AWCValue
import org.json.JSONArray
import org.json.JSONObject

/** md-breadcrumbs / md-breadcrumb-item in the Laboratory: typed hooks, retained property updates and expand()/collapse(). */
private fun breadcrumbValues(request:JSONObject,field:String):Map<String,Any?> {
    val obj=request.optJSONObject(field) ?: return emptyMap()
    return obj.keys().asSequence().associateWith { k-> obj.opt(k).let { v-> when(v) { JSONObject.NULL->null
        is JSONObject->v.keys().asSequence().associateWith { e-> v.opt(e) }
        is JSONArray->(0 until v.length()).map { v.opt(it) }
        else->v } } }
}
/** Defaults first, local values win (the nearer custom property); the crumb page uses its own request fields. */
internal fun parseLivePreviewBreadcrumbsAppearance(request:JSONObject,tag:String):AWCBreadcrumbsAppearance {
    val key=if(tag=="md-breadcrumb-item") "breadcrumbItemAppearance" else "breadcrumbsAppearance"
    return AWCBreadcrumbsAppearance.fromValues(breadcrumbValues(request,key+"Defaults")).merging(AWCBreadcrumbsAppearance.fromValues(breadcrumbValues(request,key)))
}
private val trailUpdates=setOf("label","expandLabel","separator","maxItems","itemsBeforeCollapse","itemsAfterCollapse","density")
private val itemUpdates=setOf("href","target","rel","current","icon","disabled","density")
internal fun parseLivePreviewBreadcrumbsUpdate(request:JSONObject,tag:String):Map<String,AWCValue> {
    require(request.keys().asSequence().all { it in setOf("command","properties") } && request.optString("command")=="update") { "Expected a property update." }
    val properties=request.getJSONObject("properties")
    require(properties.length()>0) { "A property update must contain at least one field." }
    val declared=if(tag=="md-breadcrumbs") trailUpdates else itemUpdates
    return properties.keys().asSequence().associateWith { name->
        val value=properties.get(name)
        require(name in declared) { "Unknown $tag property: $name" }
        when(name) {
            "current","disabled"->require(value is Boolean) { "$name must be Boolean." }
            "maxItems","itemsBeforeCollapse","itemsAfterCollapse"->require(value is Number && value.toDouble()>=0 && value.toDouble()%1.0==0.0) { "$name must be a nonnegative integer." }
            "density"->require(value is Number && value.toDouble() in listOf(0.0,-1.0,-2.0,-3.0,-4.0)) { "density must be 0 to -4." }
            else->require(value is String && value.toByteArray(Charsets.UTF_8).size<=4096) { "$name must be a string." }
        }
        if(value is Number && name!="density") value.toInt() else value
    }
}
/** expand() / collapse() set the trail state and emit mdExpand (also with maxItems 0, as the source). */
internal fun invokeLivePreviewBreadcrumbsMethod(request:JSONObject,controller:AWCBreadcrumbsController):Any? {
    val method=request.optString("method");val args=request.optJSONArray("arguments") ?: JSONArray()
    require(method in setOf("expand","collapse")) { "Unsupported native method." }
    require(args.length()==0) { "$method requires no arguments." }
    if(method=="expand") controller.expand() else controller.collapse()
    return null
}
