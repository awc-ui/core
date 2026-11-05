package dev.awc.playground

import androidx.compose.runtime.Composable
import dev.awc.nativeui.*
import org.json.JSONArray
import org.json.JSONObject

/** md-slider and md-rating in the Laboratory host: typed hooks (defaults first, local values win), retained updates with the
 *  source property types, and focusRating() through AWCRatingController. */
internal val livePreviewSRTags = setOf("md-slider", "md-rating")
internal val livePreviewSRMethodTags = setOf("md-rating")

internal class LivePreviewSROptions(val slider: AWCSliderAppearance = AWCSliderAppearance(), val rating: AWCRatingAppearance = AWCRatingAppearance())

private fun srJson(value: Any?): Any? = when (value) {
    JSONObject.NULL -> null
    is JSONObject -> value.keys().asSequence().associateWith { srJson(value.opt(it)) }
    is JSONArray -> List(value.length()) { srJson(value.opt(it)) }
    is Number -> value.toDouble()
    else -> value
}
private fun srValues(request: JSONObject, field: String): Map<String, AWCValue> {
    val obj = request.optJSONObject(field) ?: return emptyMap()
    return obj.keys().asSequence().associateWith { srJson(obj.opt(it)) }
}
internal fun parseLivePreviewSROptions(request: JSONObject): LivePreviewSROptions = when (request.optString("tag")) {
    "md-slider" -> LivePreviewSROptions(slider = AWCSliderAppearance.fromValues(srValues(request, "sliderAppearanceDefaults")).merging(AWCSliderAppearance.fromValues(srValues(request, "sliderAppearance"))))
    "md-rating" -> LivePreviewSROptions(rating = AWCRatingAppearance.fromValues(srValues(request, "ratingAppearanceDefaults")).merging(AWCRatingAppearance.fromValues(srValues(request, "ratingAppearance"))))
    else -> LivePreviewSROptions()
}

@Composable internal fun LivePreviewSRScope(o: LivePreviewSROptions, rating: AWCRatingController, content: @Composable () -> Unit) =
    AWCSliderAppearanceScope(o.slider) { AWCRatingAppearanceScope(o.rating) { AWCRatingControllerScope(rating) { content() } } }

// Source property types (IR); getLabel is a closure (native API only).
private val srSpec = mapOf(
    "md-slider" to "min:n max:n value:n step:n disabled:b name:s nameStart:s nameEnd:s variant:e=standard|centered range:b stops:b valueStart:n valueEnd:n size:e=xs|sm|md|lg|xl orientation:e=horizontal|vertical fullHeight:b valueIndicator:b labeled:b insetIcon:b icon:s sliderAriaLabel:s ariaLabelStart:s ariaLabelEnd:s valueText:s valueStartText:s valueEndText:s controlled:b density:d",
    "md-rating" to "value:n defaultValue:n max:n precision:p size:e=xs|sm|md|lg|xl readonly:b disabled:b softDisabled:b icon:s emptyIcon:s outlineEmpty:b showValueLabel:b ratingLabel:s name:s hover:e=preview|off density:d",
).mapValues { (_, spec) -> spec.split(' ').associate { it.substringBefore(':') to it.substringAfter(':') } }
private fun srText(v: Any?, limit: Int = 4096) = v is String && v.toByteArray().size <= limit
private fun srFinite(v: Any?) = v is Number && v.toDouble().isFinite()

/** Retained property updates with the source property types. */
internal fun parseLivePreviewSRUpdate(tag: String, request: JSONObject): Map<String, AWCValue> {
    require(request.keys().asSequence().all { it in setOf("command", "properties") } && request.optString("command") == "update") { "Expected a property update." }
    val properties = request.getJSONObject("properties"); val types = srSpec.getValue(tag)
    require(properties.length() > 0) { "A property update must contain at least one field." }
    return properties.keys().asSequence().associateWith { name ->
        val raw = properties.get(name); val type = types[name] ?: throw IllegalArgumentException("Unknown $tag property: $name")
        val ok = when (type) {
            "b" -> raw is Boolean
            "n" -> srFinite(raw)
            "s" -> srText(raw)
            "d" -> raw is Number && raw.toDouble() in setOf(0.0, -1.0, -2.0, -3.0, -4.0)
            "p" -> raw is Number && raw.toDouble() in setOf(1.0, 0.5)
            else -> type.startsWith("e=") && raw is String && raw in type.removePrefix("e=").split('|')
        }
        require(ok) { "Invalid $tag $name." }
        srJson(raw)
    }
}

/** focusRating() through the native controller. */
internal fun invokeLivePreviewSRMethod(tag: String, request: JSONObject, rating: AWCRatingController): Any? {
    val method = request.optString("method"); val args = request.optJSONArray("arguments") ?: JSONArray()
    require(tag == "md-rating" && method == "focusRating") { "Unsupported native method." }
    require(args.length() == 0) { "focusRating requires no arguments." }
    check(rating.isConnected) { "The md-rating is not mounted." }
    rating.focusRating(); return null
}
