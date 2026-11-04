package dev.awc.playground

import dev.awc.nativeui.AWCValue
import org.json.JSONObject

/** Text-only slots with an existing native content adapter. Structural children
 * (tabs, table rows, menu items, actions) retain their interactive fixtures. */
internal val previewTextSlots: Map<String, Set<String>> = mapOf(
    "md-accordion-item" to setOf(""), "md-bottom-sheet" to setOf(""),
    "md-breadcrumb-item" to setOf(""), "md-button" to setOf("", "leading-icon", "trailing-icon", "loader"),
    "md-card" to setOf(""), "md-chip" to setOf(""), "md-dialog" to setOf(""), "md-icon-button" to setOf("","selected"),
    "md-badge" to setOf("icon"), "md-fab" to setOf("icon"), "md-fab-menu-item" to setOf("","icon"), "md-list-item" to setOf("", "expanded-content"),
    "md-segmented-button" to setOf("","icon"), "md-side-sheet" to setOf(""),
    "md-snackbar" to setOf("","action","close"), "md-split-button" to setOf(""), "md-step" to setOf(""),
    "md-tab-panel" to setOf(""), "md-table-cell" to setOf(""),
    "md-table-row" to setOf("expanded"), "md-table-sort-label" to setOf(""),
)

internal fun parseLivePreviewSlots(request: JSONObject, tag: String): Map<String, AWCValue> {
    if (!request.has("slots")) return emptyMap()
    val slots = request.get("slots")
    require(slots is JSONObject && slots.length() <= 32) { "Preview slots must contain at most 32 entries." }
    var bytes = 0
    val result = slots.keys().asSequence().associateWith { name ->
        require(name.length <= 80) { "Preview slot names must contain at most 80 characters." }
        val value = slots.get(name)
        val parsed: AWCValue = if (value is String) value else {
            require((tag == "md-button" && name in setOf("leading-icon", "trailing-icon", "loader") ||
                tag == "md-icon-button" && name in setOf("","selected") ||
                tag in setOf("md-fab","md-fab-menu-item","md-badge","md-segmented-button") && name == "icon") && value is JSONObject) { "Only button icon slots accept native content descriptors." }
            when (value.optString("kind")) {
                "symbol" -> {
                    require(value.length() == 2 && value.has("value") && value.get("value") is String) { "A symbol requires kind and value." }
                    val symbol = value.getString("value")
                    require(symbol.matches(Regex("[a-z][a-z0-9_]{0,79}"))) { "Invalid Material Symbol name." }
                    mapOf("kind" to "symbol", "value" to symbol)
                }
                "progress" -> {
                    require(tag == "md-button" && name == "loader" && value.length() == 1) { "Progress is only supported in the loader slot." }
                    mapOf("kind" to "progress")
                }
                else -> throw IllegalArgumentException("Unsupported native slot kind.")
            }
        }
        val size = value.toString().toByteArray(Charsets.UTF_8).size
        require(size <= 4096) { "Preview slot text exceeds 4096 UTF-8 bytes." }
        bytes += size
        require(bytes <= 32768) { "Preview slots exceed 32768 UTF-8 bytes." }
        parsed
    }
    return result.filterKeys { it in previewTextSlots[tag].orEmpty() }
}

/** Fixture labels must not mask explicitly edited default content. */
internal fun previewSlotProperties(tag: String, properties: Map<String, AWCValue>, slots: Map<String, AWCValue>): Map<String, AWCValue> =
    if ("" !in slots) properties else when (tag) {
        "md-chip", "md-list-item" ->
            properties + mapOf("label" to "", "headline" to "", "text" to "")
        "md-snackbar" -> properties + ("message" to "")
        else -> properties
    }
