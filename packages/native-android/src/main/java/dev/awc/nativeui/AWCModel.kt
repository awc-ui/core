package dev.awc.nativeui

import androidx.compose.runtime.*
import androidx.compose.ui.graphics.Color
import org.json.JSONArray
import org.json.JSONObject

/** JSON-compatible values: scalar, List<AWCValue>, or Map<String, AWCValue>. */
typealias AWCValue = Any?
internal typealias Props = Map<String, AWCValue>
internal fun awcProperties(tag: String, overrides: Props): Props = dev.awc.nativeui.generated.AWCNativeCatalog.defaults[tag].orEmpty() + overrides
internal typealias EventSink = (String, AWCValue) -> Unit
internal typealias Slot = @Composable (String) -> Unit

internal fun Props.str(key: String, fallback: String = ""): String = this[key]?.toString() ?: fallback
internal fun Props.bool(key: String, fallback: Boolean = false): Boolean = when(val v = this[key]) { is Boolean -> v; is String -> v == "true"; is Number -> v.toInt() != 0; else -> fallback }
internal fun Props.num(key: String, fallback: Float = 0f): Float = (this[key] as? Number)?.toFloat() ?: this[key]?.toString()?.toFloatOrNull() ?: fallback
internal fun Props.limit(key: String): Int = int(key).takeIf { it > 0 } ?: Int.MAX_VALUE
internal fun Props.int(key: String, fallback: Int = 0): Int = num(key, fallback.toFloat()).toInt()
internal fun Props.list(key: String): List<AWCValue> = awcList(this[key])
internal fun Props.enabled() = !bool("disabled") && !bool("softDisabled")
internal fun Props.label(fallback: String = ""): String = str("label", str("headline", fallback))
internal fun awcList(value: AWCValue): List<AWCValue> = when(value) { is List<*> -> value; is JSONArray -> List(value.length()) { awcJson(value.opt(it)) }; is String -> runCatching { awcList(JSONArray(value)) }.getOrDefault(emptyList()); else -> emptyList() }
@Suppress("UNCHECKED_CAST") internal fun awcMap(value: AWCValue): Props = when(value) { is Map<*, *> -> value as Props; is JSONObject -> value.keys().asSequence().associateWith { awcJson(value.opt(it)) }; else -> emptyMap() }
internal fun awcJson(value: AWCValue): AWCValue = when(value) { JSONObject.NULL -> null; is JSONObject -> awcMap(value); is JSONArray -> awcList(value); else -> value }
internal fun awcColor(value: String, fallback: Color): Color = runCatching {
    val css = value.trim()
    if(css.startsWith("rgb")) {
        val channels = css.substringAfter('(').substringBefore(')').split(',', ' ', '/').filter { it.isNotBlank() }.map { it.toFloat() }
        Color(channels[0] / 255f, channels[1] / 255f, channels[2] / 255f, channels.getOrElse(3) { 1f })
    } else if(css.startsWith("#") && css.length == 9) {
        Color(android.graphics.Color.parseColor("#" + css.takeLast(2) + css.substring(1, 7)))
    } else if(css.startsWith("#") && css.length == 5) {
        val hex = css.drop(1).map { "$it$it" }; Color(android.graphics.Color.parseColor("#${hex[3]}${hex[0]}${hex[1]}${hex[2]}"))
    } else Color(android.graphics.Color.parseColor(css))
}.getOrDefault(fallback)

/** Local state follows every changed upstream value; callers may hoist changes via onEvent. */
@Composable internal fun <T> awcState(external: AWCValue, initial: () -> T): MutableState<T> = remember(external) { mutableStateOf(initial()) }

internal data class Choice(val value: String, val label: String, val disabled: Boolean = false, val description: String = "")
internal fun Props.choices(key: String = "options"): List<Choice> = list(key).map { value ->
    val map = awcMap(value)
    if (map.isEmpty()) Choice(value.toString(), value.toString())
    else Choice(map.str("value", map.str("id")), map.str("label", map.str("name", map.str("value"))), map.bool("disabled"), map.str("description", map.str("supportingText")))
}
internal fun eventDetail(vararg pairs: Pair<String, AWCValue>): Props = mapOf(*pairs)
