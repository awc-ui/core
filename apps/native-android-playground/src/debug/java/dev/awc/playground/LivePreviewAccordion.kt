package dev.awc.playground

import dev.awc.nativeui.AWCAccordionAppearance
import dev.awc.nativeui.AWCAccordionItemAppearance
import dev.awc.nativeui.AWCValue
import org.json.JSONArray
import org.json.JSONObject

/** Typed accordion appearance from the Laboratory request (objects and shadow lists stay structured). */
private fun livePreviewAccordionValues(request:JSONObject,field:String):Map<String,AWCValue>? {
    fun value(input:Any?,depth:Int=0):Any?=if(depth>8) null else when(input) {
        is JSONObject->input.keys().asSequence().associateWith { value(input.opt(it),depth+1) }
        is JSONArray->List(input.length()) { value(input.opt(it),depth+1) }
        JSONObject.NULL->null
        else->input
    }
    val obj=request.optJSONObject(field) ?: return null
    return obj.keys().asSequence().associateWith { value(obj.opt(it)) }
}
internal fun parseLivePreviewAccordionAppearance(request:JSONObject,field:String):AWCAccordionAppearance=
    livePreviewAccordionValues(request,field)?.let(AWCAccordionAppearance::fromValues) ?: AWCAccordionAppearance()
internal fun parseLivePreviewAccordionItemAppearance(request:JSONObject,field:String):AWCAccordionItemAppearance=
    livePreviewAccordionValues(request,field)?.let(AWCAccordionItemAppearance::fromValues) ?: AWCAccordionItemAppearance()

/** Retained md-accordion / md-accordion-item property updates with the source property types. */
internal fun parseLivePreviewAccordionUpdate(request:JSONObject,tag:String):Map<String,AWCValue> {
    require(request.keys().asSequence().all { it in setOf("command","properties") } && request.optString("command")=="update") { "Expected an Accordion property update." }
    val properties=request.getJSONObject("properties")
    require(properties.length()>0) { "A property update must contain at least one field." }
    val group=tag=="md-accordion"
    val booleans=if(group) setOf("reorderable","floating","bringToFront","exclusive","keepOneExpanded") else setOf("expanded","disabled","collapsible")
    val strings=if(group) setOf("defaultExpanded") else setOf("headline","supportingText","icon","contentMaxHeight")
    val enums=if(group) mapOf("variant" to setOf("filled","outlined"),"region" to setOf("auto","always","never"),"transition" to setOf("expressive","standard","fade","collapse","none"))
        else mapOf("regionRole" to setOf("region","group","none"))
    val integers=if(group) mapOf("density" to setOf(0.0,-1.0,-2.0,-3.0,-4.0),"elevation" to (0..5).map(Int::toDouble).toSet(),"headingLevel" to (1..6).map(Int::toDouble).toSet())
        else mapOf("density" to setOf(0.0,-1.0,-2.0,-3.0,-4.0),"headingLevel" to (1..6).map(Int::toDouble).toSet())
    val numbers=if(group) setOf("initialX","initialY","regionThreshold") else emptySet()
    return properties.keys().asSequence().associateWith { name->
        val value=properties.get(name)
        when {
            name in booleans->require(value is Boolean) { "$name must be Boolean." }
            name in strings->require(value is String && value.toByteArray(Charsets.UTF_8).size<=4096) { "Invalid $name." }
            name in enums->require(value is String && value in enums.getValue(name)) { "Invalid $name." }
            name in integers->require(value is Number && value.toDouble() in integers.getValue(name)) { "Invalid $name." }
            name in numbers->require(value is Number && value.toDouble().isFinite()) { "$name must be finite." }
            else->throw IllegalArgumentException("Unknown $tag property: $name")
        }
        value
    }
}
