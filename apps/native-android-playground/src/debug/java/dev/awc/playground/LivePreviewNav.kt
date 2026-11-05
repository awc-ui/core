package dev.awc.playground

import androidx.compose.runtime.Composable
import dev.awc.nativeui.*
import org.json.JSONArray
import org.json.JSONObject

/** n5's navigation components in the Laboratory host (md-toolbar): typed hooks (defaults first, local values win),
 *  retained updates with the source property types, and the methods through their controllers. */
internal val livePreviewNavTags = setOf("md-toolbar")
internal val livePreviewNavMethodTags = setOf("md-toolbar")

internal class LivePreviewNavOptions(val toolbar: AWCToolbarAppearance = AWCToolbarAppearance())
internal class LivePreviewNavControllers(val toolbar: AWCToolbarController = AWCToolbarController())

private fun navJson(value: Any?): Any? = when (value) {
    JSONObject.NULL -> null
    is JSONObject -> value.keys().asSequence().associateWith { navJson(value.opt(it)) }
    is JSONArray -> List(value.length()) { navJson(value.opt(it)) }
    is Number -> value.toDouble()
    else -> value
}
private fun navValues(request: JSONObject, field: String): Map<String, AWCValue> {
    val obj = request.optJSONObject(field) ?: return emptyMap()
    return obj.keys().asSequence().associateWith { navJson(obj.opt(it)) }
}
internal fun parseLivePreviewNavOptions(request: JSONObject): LivePreviewNavOptions = when (request.optString("tag")) {
    "md-toolbar" -> LivePreviewNavOptions(toolbar = AWCToolbarAppearance.fromValues(navValues(request, "toolbarAppearanceDefaults"))
        .merged(AWCToolbarAppearance.fromValues(navValues(request, "toolbarAppearance"))))
    else -> LivePreviewNavOptions()
}

@Composable internal fun LivePreviewNavScope(o: LivePreviewNavOptions, c: LivePreviewNavControllers, content: @Composable () -> Unit) =
    AWCToolbarAppearanceScope(o.toolbar) { AWCToolbarControllerScope(c.toolbar) { content() } }

// Source property types (IR).
private val navSpec = mapOf(
    "md-toolbar" to "variant:e=docked|floating color:e=standard|vibrant layout:e=horizontal|vertical alignment:e=start|center|end|space-between containerSemantics:e=toolbar|generic ariaLabelProp:s ariaLabelledby:s density:d",
).mapValues { (_, spec) -> spec.split(' ').associate { it.substringBefore(':') to it.substringAfter(':') } }
private fun navText(v: Any?, limit: Int = 4096) = v is String && v.toByteArray().size <= limit

/** Retained property updates with the source property types. */
internal fun parseLivePreviewNavUpdate(tag: String, request: JSONObject): Map<String, AWCValue> {
    require(request.keys().asSequence().all { it in setOf("command", "properties") } && request.optString("command") == "update") { "Expected a property update." }
    val properties = request.getJSONObject("properties"); val types = navSpec.getValue(tag)
    require(properties.length() > 0) { "A property update must contain at least one field." }
    return properties.keys().asSequence().associateWith { name ->
        val raw = properties.get(name); val type = types[name] ?: throw IllegalArgumentException("Unknown $tag property: $name")
        val ok = when (type) {
            "b" -> raw is Boolean
            "n" -> raw is Number && raw.toDouble().isFinite()
            "s" -> navText(raw)
            "d" -> raw is Number && raw.toDouble() in setOf(0.0, -1.0, -2.0, -3.0, -4.0)
            else -> type.startsWith("e=") && raw is String && raw in type.removePrefix("e=").split('|')
        }
        require(ok) { "Invalid $tag $name." }
        navJson(raw)
    }
}

/** The methods through the controllers (setFocus() resolves void on the Web: no result). */
internal fun invokeLivePreviewNavMethod(tag: String, request: JSONObject, c: LivePreviewNavControllers): Any? {
    val method = request.optString("method"); val args = request.optJSONArray("arguments") ?: JSONArray()
    when {
        tag == "md-toolbar" && method == "setFocus" -> { require(args.length() == 0) { "setFocus requires no arguments." }; c.toolbar.setFocus() }
        else -> throw IllegalArgumentException("Unsupported native method or arguments.")
    }
    return null
}
