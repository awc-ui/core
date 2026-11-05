package dev.awc.playground

import dev.awc.nativeui.AWCNavigationBarAppearance
import dev.awc.nativeui.AWCNavigationBarController
import dev.awc.nativeui.AWCNavigationTabAppearance
import dev.awc.nativeui.AWCNavigationTabController
import dev.awc.nativeui.AWCValue
import org.json.JSONArray
import org.json.JSONObject

/** md-navigation-bar / md-navigation-tab in the Laboratory: typed hooks, retained property updates and select / focusTab / focusEl. */
private fun navigationValues(request:JSONObject,field:String):Map<String,Any?> {
    val obj=request.optJSONObject(field) ?: return emptyMap()
    fun plain(v:Any?):Any? = when(v) { JSONObject.NULL->null
        is JSONObject->v.keys().asSequence().associateWith { plain(v.opt(it)) }
        is JSONArray->(0 until v.length()).map { plain(v.opt(it)) }
        else->v }
    return obj.keys().asSequence().associateWith { plain(obj.opt(it)) }
}
/** Defaults first, local values win (the nearer custom property). */
internal fun parseLivePreviewNavigationBarAppearance(request:JSONObject):AWCNavigationBarAppearance =
    AWCNavigationBarAppearance.fromValues(navigationValues(request,"navigationBarAppearanceDefaults")).merging(AWCNavigationBarAppearance.fromValues(navigationValues(request,"navigationBarAppearance")))
internal fun parseLivePreviewNavigationTabAppearance(request:JSONObject):AWCNavigationTabAppearance =
    AWCNavigationTabAppearance.fromValues(navigationValues(request,"navigationTabAppearanceDefaults")).merging(AWCNavigationTabAppearance.fromValues(navigationValues(request,"navigationTabAppearance")))
private val navigationUpdates=mapOf(
    "md-navigation-bar" to setOf("activeIndex","labelBehavior","manualActivation","density"),
    "md-navigation-tab" to setOf("active","disabled","softDisabled","label","icon","activeIcon","badge","badgeValue","badgeMax","href","target","labelBehavior","density"))
internal fun parseLivePreviewNavigationUpdate(request:JSONObject,tag:String):Map<String,AWCValue> {
    require(request.keys().asSequence().all { it in setOf("command","properties") } && request.optString("command")=="update") { "Expected a property update." }
    val properties=request.getJSONObject("properties")
    require(properties.length()>0) { "A property update must contain at least one field." }
    val declared=navigationUpdates.getValue(tag)
    return properties.keys().asSequence().associateWith { name->
        val value=properties.get(name)
        require(name in declared) { "Unknown $tag property: $name" }
        when(name) {
            "manualActivation","active","disabled","softDisabled","badge"->require(value is Boolean) { "$name must be Boolean." }
            "activeIndex","badgeMax"->require(value is Number && value.toDouble().isFinite()) { "$name must be a number." }
            "labelBehavior"->require(value in setOf("always","selected","none")) { "labelBehavior must be always, selected or none." }
            "density"->require(value is Number && value.toDouble() in listOf(0.0,-1.0,-2.0,-3.0,-4.0)) { "density must be 0 to -4." }
            else->require(value is String && value.toByteArray(Charsets.UTF_8).size<=4096) { "$name must be a string." }
        }
        if(value is Number) value.toDouble() else value
    }
}
/** select(index) / focusTab(index) on the bar; focusEl() on a destination. */
internal fun invokeLivePreviewNavigationMethod(tag:String,request:JSONObject,bar:AWCNavigationBarController,tab:AWCNavigationTabController):Any? {
    val method=request.optString("method");val args=request.optJSONArray("arguments") ?: JSONArray()
    if(tag=="md-navigation-tab") {
        require(method=="focusEl") { "Unsupported native method." }
        require(args.length()==0) { "focusEl requires no arguments." }
        tab.focusEl(); return null
    }
    require(method in setOf("select","focusTab")) { "Unsupported native method." }
    val index=if(args.length()==1) args.get(0) else null
    require(index is Number && index.toDouble()%1.0==0.0) { "$method requires one integer destination index." }
    if(method=="select") bar.select(index.toInt()) else bar.focusTab(index.toInt())
    return null
}
