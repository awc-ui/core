@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class, androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
package dev.awc.nativeui

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.*
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import kotlinx.coroutines.delay
import java.time.*

@Composable internal fun OverlayComponent(tag: String, p: Props, emit: EventSink, slot: Slot?) {
    var open by awcState(p["open"]) { p.bool("open") }
    fun close(cancel: Boolean = false) { if(cancel) emit("mdCancel", null); open = false; emit("mdClose", null) }
    LaunchedEffect(open) { if(open) emit("mdOpen", null) }
    when(tag) {
        "md-dialog" -> if(open) AlertDialog(
            onDismissRequest = { if(p.bool("scrimDismissible", true)) close(true) },
            title = { Text(p.str("headline")) },
            text = { Column { slot?.invoke("") } },
            icon = if(p.str("icon").isNotBlank()) ({ Glyph(p.str("icon")) }) else null,
            confirmButton = { slot?.invoke("actions"); TextButton(onClick = { close() }) { Text(p.str("okLabel", "OK")) } },
            dismissButton = { TextButton(onClick = { close(true) }) { Text(p.str("cancelLabel", "Cancel")) } },
            properties = DialogProperties(dismissOnClickOutside = p.bool("scrimDismissible", true), usePlatformDefaultWidth = !p.bool("fullscreen"))
        )
        "md-bottom-sheet" -> if(open) ModalBottomSheet(onDismissRequest = { if(p.bool("scrimDismissible", true)) close(true) }, dragHandle = if(p.bool("showDragHandle", true)) ({ BottomSheetDefaults.DragHandle() }) else null) {
            Column(Modifier.fillMaxWidth().padding(24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                Text(p.str("headline"), style = MaterialTheme.typography.headlineSmall)
                if(p.bool("topDivider")) HorizontalDivider()
                slot?.invoke("")
                if(p.bool("bottomDivider")) HorizontalDivider()
                slot?.invoke("actions")
                if(p.bool("closeable", true)) TextButton(onClick = { close() }) { Text("Close") }
                Spacer(Modifier.height(16.dp))
            }
        }
        "md-side-sheet" -> if(open) Dialog(onDismissRequest = { if(p.bool("scrimDismissible", true)) close(true) }, properties = DialogProperties(usePlatformDefaultWidth = false)) {
            Box(Modifier.fillMaxSize(), contentAlignment = if(p.str("side") == "start") Alignment.CenterStart else Alignment.CenterEnd) {
                Surface(Modifier.fillMaxHeight().fillMaxWidth(.85f), tonalElevation = 4.dp) {
                    Column(Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            if(p.bool("showBack")) IconButton(onClick = { emit("mdBack", null) }) { Glyph("arrow_back", "Back") }
                            Text(p.str("headline"), Modifier.weight(1f), style = MaterialTheme.typography.titleLarge)
                            if(p.bool("closeable", true)) IconButton(onClick = { close() }) { Glyph("close", "Close") }
                        }
                        slot?.invoke(""); slot?.invoke("actions")
                    }
                }
            }
        }
        "md-menu", "md-fab-menu" -> {
            slot?.invoke("anchor")
            DropdownMenu(expanded = open, onDismissRequest = { close() }) {
                if(tag == "md-fab-menu" && p.str("menuLabel").isNotEmpty()) Text(p.str("menuLabel"), Modifier.padding(12.dp))
                slot?.invoke("")
            }
        }
        "md-tooltip" -> Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Box(Modifier.clickable(enabled = p.enabled()) { open = !open; emit(if(open) "mdOpen" else "mdClose", null) }) { slot?.invoke("") }
            if(open && p.enabled()) Surface(color = MaterialTheme.colorScheme.inverseSurface, contentColor = MaterialTheme.colorScheme.inverseOnSurface, shape = MaterialTheme.shapes.small) { Column(Modifier.padding(12.dp)) { if(p.str("subhead").isNotEmpty()) Text(p.str("subhead"), style = MaterialTheme.typography.titleSmall); Text(p.str("text")); slot?.invoke("actions") } }
        }
        "md-snackbar" -> {
            if(open) Snackbar(action = if(p.str("action").isNotBlank()) ({ TextButton(onClick = { emit("mdAction", null) }) { Text(p.str("action")) } }) else null, dismissAction = if(p.bool("closeable")) ({ IconButton(onClick = { close() }) { Glyph("close", p.str("dismissLabel", "Dismiss")) } }) else null, actionOnNewLine = p.bool("stacked")) { Text(p.str("message")); slot?.invoke("") }
            LaunchedEffect(open, p["autoHideDuration"]) { if(open && p.bool("autoHide", true)) { delay(p.num("autoHideDuration", 5000f).toLong().coerceAtLeast(100)); close() } }
        }
    }
}

@Composable internal fun PickerComponent(tag: String, p: Props, emit: EventSink) {
    var open by awcState(p["open"]) { p.bool("open") }
    var value by awcState(p["value"]) { p.str("value") }
    fun openPicker() { open = true; emit(if(tag == "md-color-picker") "mdOpenChange" else "mdOpen", if(tag == "md-color-picker") mapOf("open" to true) else null) }
    fun closePicker(cancel: Boolean = false) { if(cancel) emit("mdCancel", null); open = false; emit(if(tag == "md-color-picker") "mdOpenChange" else "mdClose", if(tag == "md-color-picker") mapOf("open" to false) else null) }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        if(!p.bool("hideTrigger")) OutlinedButton(onClick = ::openPicker, enabled = p.enabled()) { Glyph(when(tag) { "md-date-picker" -> "calendar_today"; "md-time-picker" -> "schedule"; else -> "palette" }); Spacer(Modifier.width(8.dp)); Text(value.ifBlank { p.label(if(tag == "md-date-picker") "Choose date" else if(tag == "md-time-picker") "Choose time" else "Choose color") }) }
        if(p.str("supportingText").isNotEmpty()) Text(p.str("supportingText"), style = MaterialTheme.typography.bodySmall)
        if(p.bool("error")) Text(p.str("errorText"), color = MaterialTheme.colorScheme.error)
    }
    if(!open || !p.enabled()) return
    when(tag) {
        "md-date-picker" -> {
            val initial = runCatching { LocalDate.parse(value).atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli() }.getOrNull()
            val min = runCatching { LocalDate.parse(p.str("min")) }.getOrNull()
            val max = runCatching { LocalDate.parse(p.str("max")) }.getOrNull()
            val state = rememberDatePickerState(initialSelectedDateMillis = initial, selectableDates = object : SelectableDates {
                override fun isSelectableDate(utcTimeMillis: Long): Boolean { val date = Instant.ofEpochMilli(utcTimeMillis).atZone(ZoneOffset.UTC).toLocalDate(); return (min == null || !date.isBefore(min)) && (max == null || !date.isAfter(max)) }
            })
            DatePickerDialog(onDismissRequest = { if(p.bool("scrimDismissible", true)) closePicker(true) }, confirmButton = { TextButton(onClick = {
                state.selectedDateMillis?.let { millis -> value = Instant.ofEpochMilli(millis).atZone(ZoneOffset.UTC).toLocalDate().toString(); val detail = mapOf("value" to value, "date" to value); emit("mdSelected", detail); emit("mdChange", detail) }; closePicker()
            }, enabled = state.selectedDateMillis != null) { Text(p.str("okLabel", "OK")) } }, dismissButton = { TextButton(onClick = { closePicker(true) }) { Text(p.str("cancelLabel", "Cancel")) } }) { DatePicker(state) }
        }
        "md-time-picker" -> {
            val time = runCatching { LocalTime.parse(value) }.getOrDefault(LocalTime.of(12, 0))
            val state = rememberTimePickerState(time.hour, time.minute, !p.str("format").startsWith("12"))
            AlertDialog(onDismissRequest = { closePicker(true) }, title = { Text(p.str("headline", "Select time")) }, text = { TimePicker(state) }, confirmButton = { TextButton(onClick = {
                val step = p.int("minuteStep", 1).coerceIn(1, 60)
                val candidate = LocalTime.of(state.hour, (state.minute / step * step).coerceIn(0, 59))
                val min = runCatching { LocalTime.parse(p.str("min")) }.getOrNull(); val max = runCatching { LocalTime.parse(p.str("max")) }.getOrNull()
                val valid = if(min != null && max != null && min > max) candidate >= min || candidate <= max else (min == null || candidate >= min) && (max == null || candidate <= max)
                if(valid) { value = "%02d:%02d".format(candidate.hour, candidate.minute); val date = LocalDate.now().atTime(candidate).atZone(ZoneId.systemDefault()).toInstant().toString(); val detail = mapOf("value" to value, "iso" to "$value:00", "isoDateTime" to date, "date" to date, "hours" to candidate.hour, "minutes" to candidate.minute, "period" to if(candidate.hour >= 12) "PM" else "AM"); emit("mdInput", detail); emit("mdChange", detail); closePicker() }
            }) { Text(p.str("okLabel", "OK")) } }, dismissButton = { TextButton(onClick = { closePicker(true) }) { Text(p.str("cancelLabel", "Cancel")) } })
        }
        "md-color-picker" -> {
            var color by remember(value) { mutableStateOf(awcColor(value, Color(0xff6750a4))) }
            fun hex(c: Color): String {
                val r = (c.red * 255).toInt(); val g = (c.green * 255).toInt(); val b = (c.blue * 255).toInt()
                return if(p.str("format") == "rgb") "rgba($r, $g, $b, ${c.alpha})" else "#%02x%02x%02x".format(r, g, b) + if(p.bool("alpha") && c.alpha < 1f) "%02x".format((c.alpha * 255).toInt()) else ""
            }
            AlertDialog(onDismissRequest = { if(p.bool("dismissOnOutsideClick", true)) closePicker() }, title = { Text(p.str("ariaLabelProp", "Choose color")) }, text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Box(Modifier.fillMaxWidth().height(64.dp).background(color))
                    listOf("Red", "Green", "Blue").forEachIndexed { index, channel ->
                        Text(channel)
                        val channelValue = when(index) { 0 -> color.red; 1 -> color.green; else -> color.blue }
                        Slider(channelValue, { next -> color = when(index) { 0 -> color.copy(red = next); 1 -> color.copy(green = next); else -> color.copy(blue = next) }; value = hex(color); emit("mdInput", mapOf("value" to value)) })
                    }
                    if(p.bool("alpha")) { Text("Alpha"); Slider(color.alpha, { color = color.copy(alpha = it); emit("mdInput", mapOf("value" to hex(color))) }) }
                    if(p.bool("showHex", true)) OutlinedTextField(value.ifBlank { hex(color) }, { value = it; color = awcColor(it, color); emit("mdInput", mapOf("value" to it)) }, label = { Text("Hex") }, singleLine = true)
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) { p.list("presets").forEach { preset -> val str = if(preset is Map<*, *>) awcMap(preset).str("value") else preset.toString(); Box(Modifier.size(36.dp).clip(CircleShape).background(awcColor(str, Color.Gray)).clickable { color = awcColor(str, color); value = str; emit("mdInput", mapOf("value" to str)) }.semantics { contentDescription = str }) } }
                }
            }, confirmButton = { TextButton(onClick = { value = hex(color); emit("mdChange", mapOf("value" to value)); closePicker() }) { Text("Apply") } }, dismissButton = { TextButton(onClick = { closePicker() }) { Text("Cancel") } })
        }
    }
}
