package dev.awc.nativeui

import androidx.compose.runtime.*
import java.net.URI
import java.math.BigDecimal
import java.time.LocalTime
import kotlin.math.abs
import kotlin.math.round

/** Shared declarative native rules. Length is UTF-16; pattern uses Kotlin/Java full-match syntax. */
data class AWCFormRules(
    val required: Boolean = false, val minLength: Int? = null, val maxLength: Int? = null,
    val pattern: String? = null, val min: Double? = null, val max: Double? = null,
    val step: Double? = null, val stepBase: Double = min ?: 0.0, val type: String = "text",
) {
    fun validate(value: AWCValue): String? {
        val empty = value == null || value == "" || value == false || value is List<*> && value.isEmpty()
        if (empty) return if (required) "This field is required" else null
        val text = value.toString()
        if (minLength != null && minLength >= 0 && text.length < minLength) return "Use at least $minLength characters"
        if (maxLength != null && maxLength >= 0 && text.length > maxLength) return "Use at most $maxLength characters"
        if (!pattern.isNullOrEmpty() && runCatching { Regex(pattern.orEmpty()) }.getOrNull()?.matches(text) == false) return "Value does not match the required pattern"
        if (type == "email" && !Regex("[a-zA-Z0-9.!#\u0024%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)*").matches(text)) return "Enter a valid email address"
        if (type == "url" && runCatching { URI(text).isAbsolute }.getOrDefault(false).not()) return "Enter an absolute URL"
        val lower = min?.takeIf { it.isFinite() }; val upper = max?.takeIf { it.isFinite() }
        if (type == "number" || lower != null || upper != null || step?.isFinite() == true) {
            val numeric = text.toDoubleOrNull()?.takeIf { it.isFinite() } ?: return "Enter a number"
            if (lower != null && numeric < lower) return "Value must be at least $lower"
            if (upper != null && numeric > upper) return "Value must be at most $upper"
            if (step != null && step > 0 && step.isFinite()) {
                val units = (numeric - stepBase.takeIf { it.isFinite() }.let { it ?: lower ?: 0.0 }) / step
                if (!units.isFinite() || abs(units - round(units)) > 1e-7) return "Value does not match step $step"
            }
        }
        return null
    }
}

internal val awcFormTags = setOf("md-text-field", "md-checkbox", "md-radio", "md-switch", "md-select", "md-multi-select", "md-autocomplete", "md-slider", "md-number-field", "md-date-picker", "md-time-picker", "md-rating", "md-otp-field")
internal fun formInitialValue(tag: String, p: Props): AWCValue = when (tag) {
    "md-checkbox", "md-radio" -> p.bool("checked")
    "md-switch" -> p.bool("selected")
    "md-slider" -> if (p.bool("range")) mapOf("start" to p["valueStart"], "end" to p["valueEnd"]) else p["value"]
    "md-multi-select" -> p.list("value")
    "md-autocomplete" -> if (p.bool("multiple")) p.list("value") else p["value"]
    else -> p["value"]
}
internal fun nativeFormEntries(field: AWCFormField): List<AWCFormEntry> {
    val p = field.properties; val name = field.name; val value = field.value
    if (field.disabled) return emptyList()
    fun scalar(v: AWCValue, key: String = name, allowEmptyName: Boolean = false): List<AWCFormEntry> =
        if ((!allowEmptyName && key.isEmpty()) || v == null || v is Number && !v.toDouble().isFinite()) emptyList()
        else listOf(AWCFormEntry(key, if (v is Number) formNumberString(v) else v.toString()))
    return when (field.tag) {
        "md-checkbox", "md-switch" -> if (value == true) scalar(p.str("value", "on")) else emptyList()
        "md-radio" -> if (value == true) scalar(p.str("value", "on").ifEmpty { "on" }) else emptyList()
        "md-number-field" -> scalar(value?.toString()?.toDoubleOrNull())
        "md-select", "md-date-picker", "md-otp-field" -> if (value?.toString().isNullOrEmpty()) emptyList() else scalar(value)
        "md-rating" -> if ((value as? Number)?.toDouble() == 0.0) emptyList() else scalar(value)
        "md-slider" -> if (p.bool("range")) {
            val range = value as? Map<*, *> ?: emptyMap<Any, Any>()
            if (name.isEmpty() && p.str("nameStart").isEmpty() && p.str("nameEnd").isEmpty()) emptyList()
            else scalar(range["start"], p.str("nameStart").ifEmpty { name }, true) + scalar(range["end"], p.str("nameEnd").ifEmpty { name }, true)
        } else scalar(value)
        "md-multi-select" -> (value as? List<*>)?.flatMap { scalar(it, allowEmptyName = true) }.orEmpty()
        "md-autocomplete" -> if (p.bool("multiple")) (value as? List<*>)?.flatMap { scalar(it, allowEmptyName = true) }.orEmpty() else if (value?.toString().isNullOrEmpty()) emptyList() else scalar(value)
        "md-text-field", "md-time-picker" -> scalar(value ?: "")
        else -> if (value is List<*>) value.flatMap { scalar(it) } else scalar(value)
    }
}
internal fun formNumberString(value: Number): String {
    val numeric = value.toDouble()
    if (numeric == 0.0) return "0"
    val decimal = BigDecimal(value.toString()).stripTrailingZeros()
    return if (abs(numeric) >= 1e21 || abs(numeric) < 1e-6) decimal.toString().replace("E", "e") else decimal.toPlainString()
}
internal fun validateNativeControl(tag: String, p: Props, value: AWCValue, initial: AWCValue): String? {
    if (p.bool("disabled") || tag == "md-text-field" && p.bool("readOnly")) return null
    val required = p.bool("required")
    val textRules = tag == "md-text-field"
    val numeric = textRules && p.str("type") == "number"
    val step = if (numeric && p.str("step") != "any") p["step"]?.toString()?.toDoubleOrNull()?.takeIf { it > 0 } ?: 1.0 else null
    val min = if (numeric) p["min"]?.toString()?.toDoubleOrNull() else null
    val rules = AWCFormRules(required = required,
        minLength = if (textRules) p["minLength"]?.toString()?.toIntOrNull()?.takeIf { it >= 0 } else null,
        maxLength = if (textRules) p["maxLength"]?.toString()?.toIntOrNull()?.takeIf { it >= 0 } else null,
        pattern = if (textRules) p["pattern"]?.toString() else null,
        min = min, max = if (numeric) p["max"]?.toString()?.toDoubleOrNull() else null,
        step = step, stepBase = min ?: initial?.toString()?.toDoubleOrNull() ?: 0.0,
        type = if (textRules) p.str("type", "text") else "text")
    val basic = rules.validate(value)
    if (basic != null) return basic
    if (tag == "md-number-field" && !value?.toString().isNullOrEmpty() && value.toString().toDoubleOrNull()?.isFinite() != true) return "Enter a number"
    if (tag == "md-otp-field" && required && value.toString().length != p.int("length", 6)) return p.str("incompleteLabel", "Complete the code")
    if (tag == "md-time-picker" && !value?.toString().isNullOrEmpty()) {
        val time = runCatching { LocalTime.parse(value.toString()) }.getOrNull() ?: return "Enter a valid time"
        val low = runCatching { LocalTime.parse(p.str("min")) }.getOrNull()
        val high = runCatching { LocalTime.parse(p.str("max")) }.getOrNull()
        val invalid = if (low != null && high != null && low > high) time < low && time > high else low != null && time < low || high != null && time > high
        if (invalid) return "Time is outside the allowed range"
    }
    return null
}

internal class AWCAutomaticFormControl(val field: AWCFormField, val form: AWCFormState?, val properties: Props, val emit: EventSink)
@Composable internal fun rememberAutomaticFormControl(tag: String, source: Props, emit: EventSink): AWCAutomaticFormControl? {
    if (tag !in awcFormTags) return null
    val form = currentAWCForm() ?: return null
    val initial = remember(tag) { copyFormValue(formInitialValue(tag, source)) }
    val field = remember(tag) { AWCFormField(source.str("name"), initial) { null }.also { it.tag = tag } }
    val latest = rememberUpdatedState(source)
    SideEffect {
        field.name = source.str("name"); field.properties = source
        field.validator = { validateNativeControl(tag, latest.value, it, initial) }
    }
    DisposableEffect(form, field) { form.attach(field); onDispose { form.unregister(field) } }
    val external = formInitialValue(tag, source)
    LaunchedEffect(external, form) { field.value = copyFormValue(external); if (tag == "md-radio") form.selectRadio(field); form.refreshErrors() }
    val controlled = when (tag) {
        "md-checkbox", "md-radio" -> source + mapOf("checked" to field.value)
        "md-switch" -> source + mapOf("selected" to field.value)
        "md-slider" -> if (source.bool("range")) source + mapOf("valueStart" to (field.value as? Map<*, *>)?.get("start"), "valueEnd" to (field.value as? Map<*, *>)?.get("end")) else source + mapOf("value" to field.value)
        else -> source + mapOf("value" to field.value)
    }
    val resetAware = controlled + mapOf("_awcFormReset" to field.resetVersion)
    val p = if (field.error != null) resetAware + mapOf("error" to true, "errorText" to field.error) else resetAware
    val sink: EventSink = { name, detail ->
        if (name == "mdInput" || name == "mdChange" || name == "mdSelected") {
            val map = detail as? Map<*, *>
            when (tag) {
                "md-checkbox", "md-radio" -> if (map?.containsKey("checked") == true) field.value = map["checked"]
                "md-switch" -> if (map?.containsKey("selected") == true) field.value = map["selected"]
                "md-number-field" -> if (map?.containsKey("value") == true) field.value = map["formattedValue"] ?: map["value"]
                "md-slider" -> if (map != null) field.value = if (source.bool("range")) mapOf("start" to map["valueStart"], "end" to map["valueEnd"]) else map["value"]
                "md-autocomplete", "md-select", "md-multi-select" -> if (name != "mdInput") field.value = detail
                "md-date-picker", "md-time-picker" -> field.value = if (map?.containsKey("value") == true) map["value"] else detail
                else -> field.value = detail
            }
            if (tag == "md-radio") form.selectRadio(field)
            form.refreshErrors()
        }
        emit(name, detail)
    }
    return AWCAutomaticFormControl(field, form, p, sink)
}
