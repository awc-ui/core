package dev.awc.playground

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.requiredSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import dev.awc.nativeui.AWCColorPickerAppearance
import dev.awc.nativeui.AWCColorPickerAppearanceScope
import dev.awc.nativeui.AWCColorPickerController
import dev.awc.nativeui.AWCColorPickerControllerScope
import dev.awc.nativeui.AWCColorPickerScope
import dev.awc.nativeui.AWCModalScope
import dev.awc.nativeui.AWCTimePickerAppearance
import dev.awc.nativeui.AWCTimePickerAppearanceScope
import dev.awc.nativeui.AWCTimePickerController
import dev.awc.nativeui.AWCTimePickerControllerScope
import dev.awc.nativeui.AWCValue
import org.json.JSONArray
import org.json.JSONObject

/** md-color-picker / md-time-picker in the Laboratory: typed hooks (picker-appearance.js), retained updates of every source
 *  property, the methods through AWCColorPickerController / AWCTimePickerController, and the overlay viewport. */
internal data class LivePreviewPickerAppearances(val colorPicker: AWCColorPickerAppearance = AWCColorPickerAppearance(), val timePicker: AWCTimePickerAppearance = AWCTimePickerAppearance())

private fun pickerValues(request: JSONObject, field: String): Map<String, AWCValue> {
    val obj = request.optJSONObject(field) ?: return emptyMap()
    return obj.keys().asSequence().associateWith { obj.opt(it).takeIf { v -> v != JSONObject.NULL } }
}
/** Defaults first, local values win (the nearer custom property). */
internal fun parseLivePreviewPickerAppearances(request: JSONObject, tag: String) = LivePreviewPickerAppearances(
    colorPicker = if (tag == "md-color-picker") AWCColorPickerAppearance.fromValues(pickerValues(request, "colorPickerAppearanceDefaults"))
        .merge(AWCColorPickerAppearance.fromValues(pickerValues(request, "colorPickerAppearance"))) else AWCColorPickerAppearance(),
    timePicker = if (tag == "md-time-picker") AWCTimePickerAppearance.fromValues(pickerValues(request, "timePickerAppearanceDefaults"))
        .merge(AWCTimePickerAppearance.fromValues(pickerValues(request, "timePickerAppearance"))) else AWCTimePickerAppearance(),
)

private val colorPickerProperties = setOf("locale", "variant", "value", "format", "alpha", "showHex", "showInputs", "disabled", "presets", "ariaLabelProp", "open", "dismissOnOutsideClick", "density")
private val timePickerProperties = setOf("variant", "format", "value", "name", "min", "max", "required", "label", "supportingText", "error", "errorText", "reserveSupportingSpace",
    "headline", "headlineInputLabel", "headlineDialLabel", "valueMissingLabel", "rangeUnderflowLabel", "rangeOverflowLabel", "rangeOutsideLabel", "disabled", "open", "minuteStep",
    "cancelLabel", "okLabel", "hideTrigger", "amLabel", "pmLabel", "hourLabel", "minuteLabel", "toggleDialLabel", "toggleInputLabel", "periodLabel", "periodLayout", "orientation",
    "responsive", "density")
private val pickerBooleans = setOf("alpha", "showHex", "showInputs", "disabled", "open", "dismissOnOutsideClick", "required", "error", "reserveSupportingSpace", "hideTrigger", "responsive")
private fun pickerText(v: Any?) = v is String && v.toByteArray().size <= 4096

/** Source property types (picker-appearance.js validPickerUpdate). */
internal fun parseLivePreviewPickerUpdate(tag: String, request: JSONObject): Map<String, AWCValue> {
    require(request.keys().asSequence().all { it in setOf("command", "properties") } && request.optString("command") == "update") { "Expected a property update." }
    val properties = request.getJSONObject("properties")
    require(properties.length() > 0) { "A property update must contain at least one field." }
    val declared = if (tag == "md-color-picker") colorPickerProperties else timePickerProperties
    return properties.keys().asSequence().associateWith { name ->
        val value = properties.get(name)
        require(name in declared) { "Unknown $tag property: $name" }
        val enums = when (name) {
            "variant" -> if (tag == "md-color-picker") setOf("inline", "popover") else setOf("dial", "input")
            "format" -> if (tag == "md-color-picker") setOf("hex", "rgb", "hsl") else setOf("12h", "24h")
            "periodLayout" -> setOf("vertical", "horizontal"); "orientation" -> setOf("auto", "vertical", "horizontal")
            else -> null
        }
        when {
            name in pickerBooleans -> { require(value is Boolean) { "$name must be Boolean." }; value }
            enums != null -> { require(value is String && value in enums) { "Invalid $name." }; value }
            name == "density" -> { require(value is Number && value.toDouble() in listOf(0.0, -1.0, -2.0, -3.0, -4.0)) { "Invalid density rung." }; value }
            name == "minuteStep" -> { require(value is Number && value.toDouble().isFinite()) { "minuteStep must be a finite number." }; value }
            name == "presets" && value is JSONArray -> {
                require(value.length() <= 256 && (0 until value.length()).all { pickerText(value.get(it)) }) { "presets must be strings." }
                (0 until value.length()).map { value.getString(it) }
            }
            else -> { require(pickerText(value)) { "$name must be a string of at most 4096 UTF-8 bytes." }; value }
        }
    }
}

/** md-color-picker show() / close(); md-time-picker show() / hide() and constraint validation (with results). */
internal fun invokeLivePreviewPickerMethod(tag: String, request: JSONObject, colorPicker: AWCColorPickerController, timePicker: AWCTimePickerController): Any? {
    val method = request.optString("method"); val args = request.optJSONArray("arguments") ?: JSONArray()
    val methods = if (tag == "md-color-picker") setOf("show", "close") else setOf("show", "hide", "checkValidity", "reportValidity", "getValidity")
    require(method in methods) { "Unsupported native method." }
    require(args.length() == 0) { "$method requires no arguments." }
    if (tag == "md-color-picker") {
        check(colorPicker.isConnected) { "The md-color-picker is not mounted." }
        if (method == "show") colorPicker.show() else colorPicker.close()
        return null
    }
    check(timePicker.isConnected) { "The md-time-picker is not mounted." }
    return when (method) {
        "show" -> { timePicker.show(); null }
        "hide" -> { timePicker.hide(); null }
        "checkValidity" -> timePicker.checkValidity()
        "reportValidity" -> timePicker.reportValidity()
        else -> timePicker.getValidity().let { v -> JSONObject().put("valid", v.valid).put("validationMessage", v.validationMessage)
            .put("flags", JSONObject().put("valueMissing", v.valueMissing).put("rangeUnderflow", v.rangeUnderflow).put("rangeOverflow", v.rangeOverflow)) }
    }
}

/** The pickers in the preview viewport: the time picker's dialog presents in the viewport's modal layer, the colour picker's
 *  popover opens below its trigger inside it. */
@Composable internal fun LivePreviewPicker(tag: String, width: Double, height: Double, appearances: LivePreviewPickerAppearances,
                                          colorPicker: AWCColorPickerController, timePicker: AWCTimePickerController, content: @Composable () -> Unit) {
    AWCModalScope(Modifier.requiredSize(width.toFloat().dp, height.toFloat().dp), insets = WindowInsets(0.dp)) {
        Box(Modifier.fillMaxSize())
        Box(Modifier.padding(24.dp)) {
            if (tag == "md-color-picker") AWCColorPickerScope { AWCColorPickerAppearanceScope(appearances.colorPicker) { AWCColorPickerControllerScope(colorPicker) { content() } } }
            else AWCTimePickerAppearanceScope(appearances.timePicker) { AWCTimePickerControllerScope(timePicker) { content() } }
        }
    }
}
