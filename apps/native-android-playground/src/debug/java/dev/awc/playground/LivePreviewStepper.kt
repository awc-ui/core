package dev.awc.playground

import androidx.compose.runtime.Composable
import dev.awc.nativeui.*
import org.json.JSONArray
import org.json.JSONObject

/** md-stepper and md-step in the Laboratory host: typed hooks (defaults first, local values win), retained updates with the
 *  source property types, and next() / prev() / goTo(index) / reset() through AWCStepperController. */
internal val livePreviewStepperTags = setOf("md-stepper", "md-step")
internal val livePreviewStepperMethodTags = setOf("md-stepper")

private fun stepperJson(value: Any?): Any? = when (value) {
    JSONObject.NULL -> null
    is JSONObject -> value.keys().asSequence().associateWith { stepperJson(value.opt(it)) }
    is JSONArray -> List(value.length()) { stepperJson(value.opt(it)) }
    is Number -> value.toDouble()
    else -> value
}
private fun stepperValues(request: JSONObject, field: String): Map<String, AWCValue> {
    val obj = request.optJSONObject(field) ?: return emptyMap()
    return obj.keys().asSequence().associateWith { stepperJson(obj.opt(it)) }
}
internal fun parseLivePreviewStepperOptions(request: JSONObject): AWCStepperAppearance = when (request.optString("tag")) {
    "md-stepper" -> AWCStepperAppearance.fromValues(stepperValues(request, "stepperAppearanceDefaults")).merging(AWCStepperAppearance.fromValues(stepperValues(request, "stepperAppearance")))
    "md-step" -> AWCStepperAppearance.fromValues(stepperValues(request, "stepAppearanceDefaults")).merging(AWCStepperAppearance.fromValues(stepperValues(request, "stepAppearance")))
    else -> AWCStepperAppearance()
}

@Composable internal fun LivePreviewStepperScope(appearance: AWCStepperAppearance, controller: AWCStepperController, content: @Composable () -> Unit) =
    AWCStepperAppearanceScope(appearance) { AWCStepperControllerScope(controller) { content() } }

// Source property types (IR).
private val stepperSpec = mapOf(
    "md-stepper" to "orientation:e=horizontal|vertical indicator:e=numbered|dot variant:e=default|mobile mode:e=linear|non-linear active:i autoComplete:b nav:b readonly:b nextDisabled:b loading:b lazy:b label:s stepWord:s ofWord:s completedWord:s currentWord:s errorWord:s optionalWord:s nextLabel:s backLabel:s finishLabel:s density:d",
    "md-step" to "label:s description:s completed:b active:b error:b errorText:s disabled:b optional:b editable:b icon:s completedIcon:s errorIcon:s accessibleName:s hideActions:b density:d",
).mapValues { (_, spec) -> spec.split(' ').associate { it.substringBefore(':') to it.substringAfter(':') } }
private fun stepperIndex(v: Any?) = v is Number && v.toDouble().let { it >= 0 && it <= 1000 && it == Math.floor(it) }

/** Retained property updates with the source property types. */
internal fun parseLivePreviewStepperUpdate(tag: String, request: JSONObject): Map<String, AWCValue> {
    require(request.keys().asSequence().all { it in setOf("command", "properties") } && request.optString("command") == "update") { "Expected a property update." }
    val properties = request.getJSONObject("properties"); val types = stepperSpec.getValue(tag)
    require(properties.length() > 0) { "A property update must contain at least one field." }
    return properties.keys().asSequence().associateWith { name ->
        val raw = properties.get(name); val type = types[name] ?: throw IllegalArgumentException("Unknown $tag property: $name")
        val ok = when (type) {
            "b" -> raw is Boolean
            "i" -> stepperIndex(raw)
            "s" -> raw is String && raw.toByteArray().size <= 4096
            "d" -> raw is Number && raw.toDouble() in setOf(0.0, -1.0, -2.0, -3.0, -4.0)
            else -> type.startsWith("e=") && raw is String && raw in type.removePrefix("e=").split('|')
        }
        require(ok) { "Invalid $tag $name." }
        stepperJson(raw)
    }
}

/** next() / prev() / goTo(index) / reset() through the native controller. */
internal fun invokeLivePreviewStepperMethod(tag: String, request: JSONObject, controller: AWCStepperController): Any? {
    val method = request.optString("method"); val args = request.optJSONArray("arguments") ?: JSONArray()
    require(tag == "md-stepper" && method in setOf("next", "prev", "goTo", "reset")) { "Unsupported native method." }
    check(controller.isConnected) { "The md-stepper is not mounted." }
    if (method == "goTo") {
        require(args.length() == 1 && stepperIndex(args.opt(0))) { "goTo requires one step index (an integer from 0)." }
        controller.goTo((args.get(0) as Number).toInt()); return null
    }
    require(args.length() == 0) { "$method requires no arguments." }
    when (method) { "next" -> controller.next(); "prev" -> controller.prev(); else -> controller.reset() }
    return null
}
