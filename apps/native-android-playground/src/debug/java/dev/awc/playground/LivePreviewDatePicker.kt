package dev.awc.playground

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.requiredSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import dev.awc.nativeui.AWCColorPickerScope
import dev.awc.nativeui.AWCDatePickerAppearance
import dev.awc.nativeui.AWCDatePickerAppearanceScope
import dev.awc.nativeui.AWCDatePickerController
import dev.awc.nativeui.AWCDatePickerControllerScope
import dev.awc.nativeui.AWCModalScope
import dev.awc.nativeui.AWCValue
import org.json.JSONArray
import org.json.JSONObject

/** md-date-picker in the Laboratory: the hook map (date-picker-appearance.js), retained updates of every source property but
 *  the predicate, the methods through AWCDatePickerController, and the overlay viewport. */
private fun datePickerValues(request: JSONObject, field: String): Map<String, AWCValue> {
    val obj = request.optJSONObject(field) ?: return emptyMap()
    return obj.keys().asSequence().associateWith { obj.opt(it).takeIf { v -> v != JSONObject.NULL } }
}
/** Defaults first, local values win (the nearer custom property). */
internal fun parseLivePreviewDatePickerAppearance(request: JSONObject, tag: String): AWCDatePickerAppearance =
    if (tag == "md-date-picker") AWCDatePickerAppearance.fromValues(datePickerValues(request, "datePickerAppearanceDefaults"))
        .merge(AWCDatePickerAppearance.fromValues(datePickerValues(request, "datePickerAppearance"))) else AWCDatePickerAppearance()

private val datePickerProperties = setOf("valueMissingLabel", "reserveSupportingSpace", "variant", "value", "label", "placeholder", "min", "max", "open", "disabled", "required",
    "clearable", "clearLabel", "error", "errorText", "supportingText", "locale", "dateSeparator", "fieldVariant", "firstDayOfWeek", "headline", "cancelLabel", "okLabel",
    "selectDateLabel", "enterDatesLabel", "invalidDateLabel", "previousMonthLabel", "nextMonthLabel", "previousYearLabel", "nextYearLabel", "chooseMonthLabel", "chooseYearLabel",
    "chooseMonthYearLabel", "chooseMonthAndYearLabel", "toggleCalendarLabel", "toggleTextLabel", "openCalendarLabel", "closeCalendarLabel", "calendarIcon", "yearGridLabel",
    "scrimDismissible", "outsideClickDismissible", "commitOnSelect", "name", "density")
private val datePickerBooleans = setOf("reserveSupportingSpace", "open", "disabled", "required", "clearable", "error", "scrimDismissible", "outsideClickDismissible", "commitOnSelect")

/** Source property types (date-picker-appearance.js validDatePickerUpdate; `isDateDisabled` is native API). */
internal fun parseLivePreviewDatePickerUpdate(request: JSONObject): Map<String, AWCValue> {
    require(request.keys().asSequence().all { it in setOf("command", "properties") } && request.optString("command") == "update") { "Expected a property update." }
    val properties = request.getJSONObject("properties")
    require(properties.length() > 0) { "A property update must contain at least one field." }
    return properties.keys().asSequence().associateWith { name ->
        val value = properties.get(name)
        require(name in datePickerProperties) { "Unknown md-date-picker property: $name" }
        val enums = when (name) { "variant" -> setOf("modal", "modal-input", "docked"); "fieldVariant" -> setOf("outlined", "filled"); else -> null }
        when {
            name in datePickerBooleans -> { require(value is Boolean) { "$name must be Boolean." }; value }
            enums != null -> { require(value is String && value in enums) { "Invalid $name." }; value }
            name == "density" -> { require(value is Number && value.toDouble() in listOf(0.0, -1.0, -2.0, -3.0, -4.0)) { "Invalid density rung." }; value }
            name == "firstDayOfWeek" -> { require(value is Number && value.toDouble().let { it == Math.floor(it) && it >= -1 && it <= 6 }) { "firstDayOfWeek must be an integer from -1 to 6." }; value }
            else -> { require(value is String && value.toByteArray().size <= 4096) { "$name must be a string of at most 4096 UTF-8 bytes." }; value }
        }
    }
}

/** show() / close() / clear() / focusInput() and constraint validation (with results). */
internal fun invokeLivePreviewDatePickerMethod(request: JSONObject, controller: AWCDatePickerController): Any? {
    val method = request.optString("method"); val args = request.optJSONArray("arguments") ?: JSONArray()
    require(method in setOf("show", "close", "clear", "focusInput", "checkValidity", "reportValidity", "getValidity", "setCustomValidity")) { "Unsupported native method." }
    check(controller.isConnected) { "The md-date-picker is not mounted." }
    if (method == "setCustomValidity") {
        require(args.length() == 1 && args.get(0) is String && args.getString(0).toByteArray().size <= 4096) { "setCustomValidity requires one string up to 4096 UTF-8 bytes." }
        controller.setCustomValidity(args.getString(0)); return null
    }
    require(args.length() == 0) { "$method requires no arguments." }
    return when (method) {
        "show" -> { controller.show(); null }
        "close" -> { controller.close(); null }
        "clear" -> { controller.clear(); null }
        "focusInput" -> { controller.focusInput(); null }
        "checkValidity" -> controller.checkValidity()
        "reportValidity" -> controller.reportValidity()
        else -> controller.getValidity().let { v -> JSONObject().put("valid", v.valid).put("validationMessage", v.validationMessage)
            .put("flags", JSONObject().apply { if (v.valueMissing) put("valueMissing", true); if (v.customError) put("customError", true) }) }
    }
}

/** The picker in the preview viewport: the dialog presents in the viewport's modal layer, the docked panel opens under the
 *  field inside it (outside presses through the viewport's AWCColorPickerScope registry). */
@Composable internal fun LivePreviewDatePicker(width: Double, height: Double, appearance: AWCDatePickerAppearance, controller: AWCDatePickerController, content: @Composable () -> Unit) {
    AWCModalScope(Modifier.requiredSize(width.toFloat().dp, height.toFloat().dp), insets = WindowInsets(0.dp)) {
        AWCColorPickerScope(Modifier.fillMaxSize()) {
            Box(Modifier.padding(24.dp)) {
                AWCDatePickerAppearanceScope(appearance) { AWCDatePickerControllerScope(controller) { content() } }
            }
        }
    }
}
