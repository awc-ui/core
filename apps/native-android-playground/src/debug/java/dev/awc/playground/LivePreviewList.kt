package dev.awc.playground

import dev.awc.nativeui.AWCListAppearance
import dev.awc.nativeui.AWCListController
import dev.awc.nativeui.AWCListItemAppearance
import dev.awc.nativeui.AWCListItemController
import dev.awc.nativeui.AWCValue
import org.json.JSONArray
import org.json.JSONObject

/** Typed md-list / md-list-item appearance from the Laboratory request (objects and shadow lists stay structured). */
private fun livePreviewListValues(request:JSONObject,field:String):Map<String,AWCValue>? {
    fun value(input:Any?,depth:Int=0):Any?=if(depth>8) null else when(input) {
        is JSONObject->input.keys().asSequence().associateWith { value(input.opt(it),depth+1) }
        is JSONArray->List(input.length()) { value(input.opt(it),depth+1) }
        JSONObject.NULL->null
        else->input
    }
    val obj=request.optJSONObject(field) ?: return null
    return obj.keys().asSequence().associateWith { value(obj.opt(it)) }
}
internal fun parseLivePreviewListAppearance(request:JSONObject,field:String):AWCListAppearance=
    livePreviewListValues(request,field)?.let(AWCListAppearance::fromValues) ?: AWCListAppearance()
internal fun parseLivePreviewListItemAppearance(request:JSONObject,field:String):AWCListItemAppearance=
    livePreviewListValues(request,field)?.let(AWCListItemAppearance::fromValues) ?: AWCListItemAppearance()

/** Retained md-list / md-list-item property updates with the source property types. */
internal fun parseLivePreviewListUpdate(request:JSONObject,tag:String):Map<String,AWCValue> {
    require(request.keys().asSequence().all { it in setOf("command","properties") } && request.optString("command")=="update") { "Expected a List property update." }
    val properties=request.getJSONObject("properties")
    require(properties.length()>0) { "A property update must contain at least one field." }
    val list=tag=="md-list"
    val booleans=if(list) setOf("reorderable") else setOf("disabled","softDisabled","selected","expandable","expanded","tabbable","rovingFocusVisible","reorderable")
    val strings=if(list) setOf("label","labelledby","roleOverride") else setOf("headline","overline","supportingText","trailingSupportingText","leadingIcon","trailingIcon",
        "leadingAvatar","leadingAvatarAlt","leadingAvatarName","leadingAvatarLabel","leadingImage","leadingImageAlt","href","target","containerRole")
    val modes=mapOf("selectionMode" to setOf("none","single-select","multi-select"),"interactionMode" to setOf("single-action","multi-action"))
    val enums=if(list) modes+("listStyle" to setOf("standard","segmented")) else modes+("type" to setOf("text","button","link"))
    val densities=setOf(0.0,-1.0,-2.0,-3.0,-4.0)
    val integers=if(list) mapOf("density" to densities) else mapOf("density" to densities,"lines" to setOf(1.0,2.0,3.0))
    return properties.keys().asSequence().associateWith { name->
        val value=properties.get(name)
        when {
            name in booleans->require(value is Boolean) { "$name must be Boolean." }
            name in strings->require(value is String && value.toByteArray(Charsets.UTF_8).size<=4096) { "Invalid $name." }
            name in enums->require(value is String && value in enums.getValue(name)) { "Invalid $name." }
            name in integers->require(value is Number && value.toDouble() in integers.getValue(name)) { "Invalid $name." }
            else->throw IllegalArgumentException("Unknown $tag property: $name")
        }
        value
    }
}

/** md-list / md-list-item methods through the native controllers; getSelectedIndices returns the indices. */
internal fun invokeLivePreviewListMethod(tag:String,request:JSONObject,list:AWCListController,item:AWCListItemController):JSONArray? {
    val method=request.optString("method");val args=request.getJSONArray("arguments")
    if(tag=="md-list") {
        require(method in setOf("activateNext","activatePrevious","selectItem","getSelectedIndices")) { "Unsupported md-list method: $method" }
        check(list.isConnected) { "The list is not mounted." }
        when(method) {
            "selectItem"->{
                val index=args.opt(0)
                require(args.length()==1 && index is Number && index.toDouble().let { it>=0 && it<=Int.MAX_VALUE && it==Math.floor(it) }) { "selectItem requires one row index." }
                list.selectItem((index as Number).toInt())
            }
            "getSelectedIndices"->{ require(args.length()==0) { "getSelectedIndices requires no arguments." };return JSONArray(list.getSelectedIndices()) }
            else->{ require(args.length()==0) { "$method requires no arguments." };if(method=="activateNext") list.activateNext() else list.activatePrevious() }
        }
        return null
    }
    require(method in setOf("setFocus","focusItem","toggle","expand","collapse")) { "Unsupported md-list-item method: $method" }
    check(item.isConnected) { "The list item is not mounted." }
    if(method=="setFocus") {
        var visible=false
        if(args.length()>0) {
            val options=args.opt(0)
            require(args.length()==1 && options is JSONObject && options.keys().asSequence().all { it=="focusVisible" }) { "setFocus accepts { focusVisible }." }
            if(options.has("focusVisible")) { val v=options.get("focusVisible");require(v is Boolean) { "focusVisible requires a boolean." };visible=v }
        }
        item.setFocus(visible)
    } else {
        require(args.length()==0) { "$method requires no arguments." }
        when(method) { "focusItem"->item.focusItem();"toggle"->item.toggle();"expand"->item.expand();else->item.collapse() }
    }
    return null
}
