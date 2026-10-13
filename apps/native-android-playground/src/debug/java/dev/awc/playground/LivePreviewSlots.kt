package dev.awc.playground

import dev.awc.nativeui.AWCValue
import org.json.JSONObject

/** Text-only slots with an existing native content adapter. Structural children
 * (tabs, table rows, menu items, actions) retain their interactive fixtures. */
internal val previewTextSlots: Map<String, Set<String>> = mapOf(
    "md-accordion-item" to setOf(""), "md-bottom-sheet" to setOf(""),
    "md-breadcrumb-item" to setOf(""), "md-button" to setOf(""),
    "md-card" to setOf(""), "md-chip" to setOf(""), "md-dialog" to setOf(""),
    "md-fab-menu-item" to setOf(""), "md-list-item" to setOf("", "expanded-content"),
    "md-segmented-button" to setOf(""), "md-side-sheet" to setOf(""),
    "md-snackbar" to setOf(""), "md-split-button" to setOf(""), "md-step" to setOf(""),
    "md-tab-panel" to setOf(""), "md-table-cell" to setOf(""),
    "md-table-row" to setOf("expanded"), "md-table-sort-label" to setOf(""),
)

internal fun parseLivePreviewSlots(request: JSONObject, tag: String): Map<String, String> {
    if (!request.has("slots")) return emptyMap()
    val slots = request.get("slots")
    require(slots is JSONObject && slots.length() <= 32) { "Preview slots must contain at most 32 text entries." }
    var bytes = 0
    val result = slots.keys().asSequence().associateWith { name ->
        require(name.length <= 80) { "Preview slot names must contain at most 80 characters." }
        val value = slots.get(name)
        require(value is String) { "Preview slot values must be strings." }
        val size = value.toByteArray(Charsets.UTF_8).size
        require(size <= 4096) { "Preview slot text exceeds 4096 UTF-8 bytes." }
        bytes += size
        require(bytes <= 32768) { "Preview slots exceed 32768 UTF-8 bytes." }
        value
    }
    return result.filterKeys { it in previewTextSlots[tag].orEmpty() }
}

/** Fixture labels must not mask explicitly edited default content. */
internal fun previewSlotProperties(tag: String, properties: Map<String, AWCValue>, slots: Map<String, String>): Map<String, AWCValue> =
    if ("" !in slots) properties else when (tag) {
        "md-chip", "md-fab-menu-item", "md-list-item", "md-segmented-button", "md-split-button" ->
            properties + mapOf("label" to "", "headline" to "", "text" to "")
        "md-snackbar" -> properties + ("message" to "")
        else -> properties
    }
