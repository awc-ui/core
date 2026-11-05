package dev.awc.playground

import dev.awc.nativeui.AWCTabAppearance
import dev.awc.nativeui.AWCTabsAppearance
import dev.awc.nativeui.AWCTabsController
import dev.awc.nativeui.AWCValue
import org.json.JSONArray
import org.json.JSONObject

/** md-tabs / md-tab / md-tab-panels / md-tab-panel in the Laboratory: typed hooks, retained property updates and selectTab(index). */
private fun tabValues(request:JSONObject,field:String):Map<String,Any?> {
    val obj=request.optJSONObject(field) ?: return emptyMap()
    return obj.keys().asSequence().associateWith { k-> obj.opt(k).let { v-> if(v==JSONObject.NULL) null else v } }
}
/** Defaults first, local values win (the nearer custom property). */
internal fun parseLivePreviewTabsAppearance(request:JSONObject):AWCTabsAppearance =
    AWCTabsAppearance.fromValues(tabValues(request,"tabsAppearanceDefaults")).merging(AWCTabsAppearance.fromValues(tabValues(request,"tabsAppearance")))
internal fun parseLivePreviewTabAppearance(request:JSONObject):AWCTabAppearance =
    AWCTabAppearance.fromValues(tabValues(request,"tabAppearanceDefaults")).merging(AWCTabAppearance.fromValues(tabValues(request,"tabAppearance")))
private val tabUpdates=mapOf(
    "md-tabs" to setOf("activeTabIndex","variant","divider","ariaLabelProp","tabWidth","width"),
    "md-tab" to setOf("label","icon","active","disabled","inlineIcon","variant","badge","controls","density"),
    "md-tab-panels" to setOf("for","sizing"),
    "md-tab-panel" to setOf("active"))
internal fun parseLivePreviewTabsUpdate(request:JSONObject,tag:String):Map<String,AWCValue> {
    require(request.keys().asSequence().all { it in setOf("command","properties") } && request.optString("command")=="update") { "Expected a property update." }
    val properties=request.getJSONObject("properties")
    require(properties.length()>0) { "A property update must contain at least one field." }
    val declared=tabUpdates.getValue(tag)
    return properties.keys().asSequence().associateWith { name->
        val value=properties.get(name)
        require(name in declared) { "Unknown $tag property: $name" }
        when(name) {
            "active","disabled","inlineIcon"->require(value is Boolean) { "$name must be Boolean." }
            "activeTabIndex"->require(value is Number && value.toDouble().isFinite()) { "activeTabIndex must be a number." }
            "variant"->require(value in setOf("primary","secondary")) { "variant must be primary or secondary." }
            "divider"->require(value in setOf("auto","full")) { "divider must be auto or full." }
            "sizing"->require(value in setOf("stable","active")) { "sizing must be stable or active." }
            "density"->require(value is Number && value.toDouble() in listOf(0.0,-1.0,-2.0,-3.0,-4.0)) { "density must be 0 to -4." }
            else->require(value is String && value.toByteArray(Charsets.UTF_8).size<=4096) { "$name must be a string." }
        }
        if(value is Number) value.toDouble() else value
    }
}
/** selectTab(index): an index outside the tabs is ignored; otherwise activates and emits mdTabChange like a click. */
internal fun invokeLivePreviewTabsMethod(request:JSONObject,controller:AWCTabsController):Any? {
    val method=request.optString("method");val args=request.optJSONArray("arguments") ?: JSONArray()
    require(method=="selectTab") { "Unsupported native method." }
    val index=if(args.length()==1) args.get(0) else null
    require(index is Number && index.toDouble()%1.0==0.0) { "selectTab requires one integer tab index." }
    controller.selectTab(index.toInt())
    return null
}
