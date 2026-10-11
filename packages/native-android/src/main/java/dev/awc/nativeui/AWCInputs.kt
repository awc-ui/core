@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class, androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
package dev.awc.nativeui

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.input.key.*
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.input.*
import androidx.compose.ui.unit.dp
import kotlin.math.roundToInt

@Composable internal fun InputComponent(tag: String, p: Props, emit: EventSink, slot: Slot?, form: AWCFormState? = null) {
    val enabled = p.enabled()
    when(tag) {
        "md-checkbox", "md-radio", "md-switch" -> {
            val key = if(tag == "md-switch") "selected" else "checked"
            var checked by awcState(p[key]) { p.bool(key) }
            var indeterminate by awcState(listOf(p["indeterminate"], p["_awcFormReset"])) { p.bool("indeterminate") }
            val change: (Boolean) -> Unit = { value ->
                checked = value; indeterminate = false
                val detail = when(tag) {
                    "md-switch" -> eventDetail("selected" to checked)
                    "md-radio" -> eventDetail("checked" to checked, "value" to p["value"])
                    else -> eventDetail("checked" to checked, "indeterminate" to false)
                }
                if(tag == "md-switch") emit("mdInput", detail)
                emit("mdChange", detail)
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                when(tag) {
                    "md-checkbox" -> TriStateCheckbox(state = if(indeterminate) androidx.compose.ui.state.ToggleableState.Indeterminate else if(checked) androidx.compose.ui.state.ToggleableState.On else androidx.compose.ui.state.ToggleableState.Off, onClick = { change(!checked) }, enabled = enabled)
                    "md-radio" -> RadioButton(checked, onClick = { change(true) }, enabled = enabled)
                    else -> Switch(checked, change, enabled = enabled)
                }
                Column(Modifier.padding(start = 8.dp)) { slot?.invoke(""); if(p.str("supportingText").isNotBlank()) Text(p.str("supportingText"), style = MaterialTheme.typography.bodySmall); if(p.bool("error")) Text(p.str("errorText"), color = MaterialTheme.colorScheme.error) }
            }
        }
        "md-slider" -> {
            val min = p.num("min"); val max = p.num("max", 100f).coerceAtLeast(min + .001f)
            val steps = ((max - min) / p.num("step", 1f).coerceAtLeast(.001f)).roundToInt().minus(1).coerceIn(0, 1000)
            if(p.bool("range")) {
                var range by awcState(listOf(p["valueStart"],p["valueEnd"])) { p.num("valueStart", min).coerceIn(min, max)..p.num("valueEnd", max).coerceIn(min, max) }
                RangeSlider(range, { range = it; emit("mdInput", mapOf("value" to it.endInclusive, "valueStart" to it.start, "valueEnd" to it.endInclusive)) }, enabled = enabled, valueRange = min..max, steps = steps, onValueChangeFinished = { emit("mdChange", mapOf("value" to range.endInclusive, "valueStart" to range.start, "valueEnd" to range.endInclusive)) }, modifier = Modifier.semantics { contentDescription = p.str("sliderAriaLabel", "Range") })
            } else {
                var value by awcState(p["value"]) { p.num("value", min).coerceIn(min, max) }
                Column {
                    Slider(value, { value = it; emit("mdInput", mapOf("value" to it)) }, enabled = enabled, valueRange = min..max, steps = steps, onValueChangeFinished = { emit("mdChange", mapOf("value" to value)) }, modifier = Modifier.semantics { contentDescription = p.str("sliderAriaLabel", "Value") })
                    if(p.bool("labeled") || p.bool("valueIndicator")) Text(p.str("valueText", value.toString()))
                }
            }
        }
        "md-rating" -> {
            val max = p.int("max", 5).coerceIn(1, 20)
            var value by awcState(p["value"]) { p.num("value", p.num("defaultValue")) }
            Row(verticalAlignment = Alignment.CenterVertically) {
                repeat(max) { index ->
                    IconButton(onClick = { value = if(value == index + 1f) 0f else index + 1f; emit("mdChange", value) }, enabled = enabled && !p.bool("readonly"), modifier = Modifier.size(40.dp).semantics { contentDescription = "${index + 1} of $max"; selected = value >= index + 1 }) {
                        Text(if(value >= index + 1) "★" else "☆", color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.headlineMedium)
                    }
                }
                if(p.bool("showValueLabel")) Text(value.toString())
            }
        }
        "md-select", "md-multi-select", "md-autocomplete" -> SelectInput(tag, p, emit, slot)
        "md-select-option" -> ListItem(headlineContent = { Text(p.label(p.str("value"))) }, supportingContent = { if(p.str("supportingText").isNotBlank()) Text(p.str("supportingText")) }, trailingContent = { if(p.bool("selected")) Glyph("check") }, modifier = Modifier.clickable(enabled = enabled) { emit("mdSelectOptionChange", mapOf("value" to p["value"], "selected" to true)) })
        else -> TextInput(tag, p, emit, slot, form)
    }
}

@Composable private fun TextInput(tag: String, p: Props, emit: EventSink, slot: Slot?, form: AWCFormState?) {
    var value by awcState(p["value"]) { p.str("value") }
    var visible by remember { mutableStateOf(false) }
    var focused by remember { mutableStateOf(false) }
    val number = tag == "md-number-field"
    val otp = tag == "md-otp-field"
    val search = tag == "md-search"
    val password = p.str("type") == "password" || (otp && p.bool("mask"))
    val enabled = p.enabled()
    fun commit(reason: String = "input-change") {
        if(number) {
            val raw = value.toDoubleOrNull()
            val minimum = p.num("min", -Float.MAX_VALUE).toDouble()
            val maximum = p.num("max", Float.MAX_VALUE).toDouble().coerceAtLeast(minimum)
            val result = if(p.bool("allowOutOfRange")) raw else raw?.coerceIn(minimum, maximum)
            value = if (result != null) formNumberString(result) else ""
            emit("mdChange", mapOf("value" to result, "formattedValue" to value, "reason" to reason))
        } else emit("mdChange", if(search) mapOf("value" to value) else value)
    }
    fun update(raw: String) {
        var next = raw.take(p.int("maxLength", if(otp) p.int("length", 6) else Int.MAX_VALUE).coerceAtLeast(0))
        if(otp) {
            val valid = when(p.str("validationType", "numeric")) { "numeric" -> next.all { it.isDigit() }; "alphanumeric" -> next.all { it.isLetterOrDigit() }; "alpha" -> next.all { it.isLetter() }; else -> true }
            if(!valid) { emit("mdInvalidInput", mapOf("attempted" to raw, "reason" to "input-change")); return }
            next = when(p.str("transform")) { "uppercase" -> next.uppercase(); "lowercase" -> next.lowercase(); else -> next }
        }
        if(number && next.isNotEmpty() && !next.matches(Regex("[-+]?[0-9]*[.]?[0-9]*"))) return
        value = next
        emit("mdInput", if(number) mapOf("value" to value.toDoubleOrNull(), "formattedValue" to value, "reason" to "input-change") else if(search) mapOf("value" to value) else value)
        if(tag == "md-text-field") emit("mdSearch", value)
        if(search) emit("mdSearch", mapOf("value" to value))
        if(otp) { emit("mdChange", value); if(value.length == p.int("length", 6)) emit("mdComplete", mapOf("value" to value)) }
    }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        val trailing: @Composable () -> Unit = {
            Row {
                if(number && p.str("steppers", "trailing") != "none") {
                    IconButton(onClick = { value = ((value.toDoubleOrNull() ?: 0.0) - p.num("step", 1f)).toString(); commit("step-down"); emit("mdInput", mapOf("value" to value.toDoubleOrNull(), "formattedValue" to value, "reason" to "step-down")) }, enabled = enabled && !p.bool("readOnly")) { Glyph("remove", p.str("decrementLabel", "Decrease")) }
                    IconButton(onClick = { value = ((value.toDoubleOrNull() ?: 0.0) + p.num("step", 1f)).toString(); commit("step-up"); emit("mdInput", mapOf("value" to value.toDoubleOrNull(), "formattedValue" to value, "reason" to "step-up")) }, enabled = enabled && !p.bool("readOnly")) { Glyph("add", p.str("incrementLabel", "Increase")) }
                }
                if(password && p["passwordToggle"] != false && p["passwordToggle"] != null) IconButton(onClick = { if(p.str("passwordToggle") != "external") visible = !visible; emit("mdPasswordToggle", mapOf("visible" to if(p.str("passwordToggle") == "external") !visible else visible)) }) { Glyph(if(visible) "visibility_off" else "visibility", if(visible) p.str("hidePasswordLabel", "Hide password") else p.str("showPasswordLabel", "Show password")) }
                if((p.bool("clearable") || (search && p.bool("showClearButton", true))) && value.isNotEmpty()) IconButton(onClick = { update(""); emit("mdClear", null); commit() }, enabled = enabled && !p.bool("readOnly")) { Glyph("close", "Clear") }
                slot?.invoke("trailing-icon")
            }
        }
        val support: @Composable () -> Unit = { if(p.bool("error")) Text(p.str("errorText")) else if(p.str("supportingText").isNotBlank()) Text(p.str("supportingText")) }
        val multiline = p["multiline"] != null && p["multiline"] != false && p["multiline"] != "false"
        fun submitFromKeyboard() { commit("enter"); if (enabled && !multiline) { if (number) form?.submit() else form?.requestSubmit() } }
        val modifier = Modifier.fillMaxWidth().onPreviewKeyEvent { event ->
            if (form != null && enabled && !multiline && event.type == KeyEventType.KeyDown &&
                (event.key == Key.Enter || event.key == Key.NumPadEnter) && !event.isCtrlPressed && !event.isAltPressed && !event.isMetaPressed && !event.isShiftPressed && event.nativeKeyEvent.repeatCount == 0) {
                submitFromKeyboard(); true
            } else false
        }.onFocusChanged { next -> if(focused && !next.isFocused) commit("blur"); focused = next.isFocused }.semantics { if(otp) contentDescription = p.label("Verification code") }
        val keyboard = KeyboardOptions(keyboardType = if(number) KeyboardType.Decimal else if(otp) KeyboardType.NumberPassword else if(password) KeyboardType.Password else if(p.str("type") == "email") KeyboardType.Email else KeyboardType.Text, imeAction = if(search) ImeAction.Search else ImeAction.Done)
        val action = KeyboardActions(onDone = { submitFromKeyboard() }, onSearch = { emit("mdSearch", if(search) mapOf("value" to value) else value); if(search) emit("mdSubmit", mapOf("value" to value)); commit() })
        val label: @Composable () -> Unit = { Text(p.label(if(search) "Search" else "" ) + if(p.bool("required")) " *" else "") }
        val placeholder: @Composable () -> Unit = { Text(p.str("placeholder")) }
        val visual = if(password && !visible) PasswordVisualTransformation() else VisualTransformation.None
        if(p.str("variant") == "filled") TextField(value, ::update, modifier, enabled = enabled, readOnly = p.bool("readOnly"), label = label, placeholder = placeholder, supportingText = support, trailingIcon = trailing, isError = p.bool("error"), singleLine = p["multiline"] == false || p["multiline"] == null, minLines = p.int("rows", 1).coerceAtLeast(1), keyboardOptions = keyboard, keyboardActions = action, visualTransformation = visual)
        else OutlinedTextField(value, ::update, modifier, enabled = enabled, readOnly = p.bool("readOnly"), label = label, placeholder = placeholder, supportingText = support, trailingIcon = trailing, isError = p.bool("error"), singleLine = p["multiline"] == false || p["multiline"] == null, minLines = p.int("rows", 1).coerceAtLeast(1), keyboardOptions = keyboard, keyboardActions = action, visualTransformation = visual, prefix = if(p.str("prefixText").isNotBlank()) ({ Text(p.str("prefixText")) }) else null, suffix = if(p.str("suffixText").isNotBlank()) ({ Text(p.str("suffixText")) }) else null)
        slot?.invoke("")
    }
}

@Composable private fun SelectInput(tag: String, p: Props, emit: EventSink, slot: Slot?) {
    val multiple = tag == "md-multi-select" || p.bool("multiple")
    val options = p.choices()
    var selected by awcState(p["value"]) { if(multiple) p.list("value").map { it.toString() } else listOf(p.str("value")).filter { it.isNotEmpty() } }
    var query by awcState(p["inputValue"]) { p.str("inputValue") }
    var open by awcState(p["open"]) { p.bool("open") }
    val filter = p.bool("filterable") || tag == "md-autocomplete"
    val current = options.filter { it.value in selected }.joinToString { it.label }
    fun setOpen(next: Boolean) { if(open != next) { open = next; emit(if(next) "mdOpen" else "mdClose", null) } }
    fun change(next: List<String>) { selected = next; emit("mdChange", if(multiple) next else next.firstOrNull().orEmpty()) }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        OutlinedButton(onClick = { setOpen(!open) }, enabled = p.enabled(), modifier = Modifier.fillMaxWidth()) { Text(current.ifBlank { p.label(p.str("placeholder", "Select")) }, Modifier.weight(1f)); Glyph("expand_more") }
        if(open) Surface(tonalElevation = 4.dp, shape = MaterialTheme.shapes.medium) {
            Column(Modifier.padding(8.dp).heightIn(max = p.num("maxHeight", 320f).coerceIn(100f, 600f).dp).verticalScroll(rememberScrollState())) {
                if(filter) OutlinedTextField(query, { query = it; emit("mdInput", it) }, label = { Text(p.str("searchPlaceholder", "Search")) }, singleLine = true, modifier = Modifier.fillMaxWidth())
                if(p.bool("loading")) LinearProgressIndicator(Modifier.fillMaxWidth())
                if(multiple && p.bool("showSelectAll")) TextButton(onClick = { change(options.filter { !it.disabled }.map { it.value }.take(p.limit("maxSelected"))) }) { Text(p.str("selectAllLabel", "Select all")) }
                val visible = options.filter { !filter || query.isEmpty() || it.label.contains(query, true) }.take(p.limit("limitResults"))
                if(visible.isEmpty()) Text(if(options.isEmpty()) p.str("noOptionsText", "No options") else p.str("noResultsText", "No results"), Modifier.padding(16.dp))
                visible.forEach { option ->
                    Row(Modifier.fillMaxWidth().clickable(enabled = p.enabled() && !option.disabled) {
                        if(multiple) { if(option.value in selected) change(selected - option.value) else if(selected.size < p.limit("maxSelected")) change(selected + option.value) }
                        else { change(listOf(option.value)); query = option.label; setOpen(false) }
                    }.padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
                        if(multiple) Checkbox(option.value in selected, null, enabled = !option.disabled)
                        Column(Modifier.weight(1f)) { Text(option.label); if(option.description.isNotBlank()) Text(option.description, style = MaterialTheme.typography.bodySmall) }
                        if(!multiple && option.value in selected) Glyph("check")
                    }
                }
                if(tag == "md-autocomplete" && p.bool("freeSolo") && query.isNotBlank() && options.none { it.value == query }) TextButton(onClick = { change(if(multiple) selected + query else listOf(query)); setOpen(false) }) { Text("Use “$query”") }
                slot?.invoke("")
            }
        }
        if(multiple) FlowRow(horizontalArrangement = Arrangement.spacedBy(4.dp)) { selected.forEach { value -> InputChip(selected = true, onClick = { change(selected - value); emit("mdRemove", value) }, enabled = p.enabled(), label = { Text(options.firstOrNull { it.value == value }?.label ?: value) }, trailingIcon = { Glyph("close", "Remove") }) } }
        if(p.bool("clearable") && selected.isNotEmpty()) TextButton(onClick = { change(emptyList()); emit("mdClear", null) }, enabled = p.enabled()) { Text(p.str("clearLabel", "Clear")) }
        if(p.bool("error")) Text(p.str("errorText"), color = MaterialTheme.colorScheme.error) else if(p.str("supportingText").isNotBlank()) Text(p.str("supportingText"), style = MaterialTheme.typography.bodySmall)
    }
}
