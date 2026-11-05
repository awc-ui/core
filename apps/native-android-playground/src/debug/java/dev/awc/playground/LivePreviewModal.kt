package dev.awc.playground

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.requiredSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import dev.awc.nativeui.AWCComponent
import dev.awc.nativeui.AWCBottomSheetAppearance
import dev.awc.nativeui.AWCBottomSheetAppearanceScope
import dev.awc.nativeui.AWCBottomSheetController
import dev.awc.nativeui.AWCBottomSheetControllerScope
import dev.awc.nativeui.AWCDialogAppearance
import dev.awc.nativeui.AWCDialogAppearanceScope
import dev.awc.nativeui.AWCDialogController
import dev.awc.nativeui.AWCDialogControllerScope
import dev.awc.nativeui.AWCModalScope
import dev.awc.nativeui.AWCSideSheetAppearance
import dev.awc.nativeui.AWCSideSheetAppearanceScope
import dev.awc.nativeui.AWCSideSheetController
import dev.awc.nativeui.AWCSideSheetControllerScope
import dev.awc.nativeui.AWCValue
import org.json.JSONArray
import org.json.JSONObject

/** md-dialog, md-bottom-sheet and md-side-sheet present in the preview's own viewport through the shared modal layer. */
internal val livePreviewModalTags = setOf("md-dialog", "md-bottom-sheet", "md-side-sheet")

private fun liveModalValue(input: Any?, depth: Int = 0): Any? = if (depth > 8) null else when (input) {
    is JSONObject -> input.keys().asSequence().associateWith { liveModalValue(input.opt(it), depth + 1) }
    is JSONArray -> List(input.length()) { liveModalValue(input.opt(it), depth + 1) }
    JSONObject.NULL -> null
    else -> input
}
private fun liveModalFields(request: JSONObject, field: String): Map<String, Any?>? =
    request.optJSONObject(field)?.let { obj -> obj.keys().asSequence().associateWith { liveModalValue(obj.opt(it)) } }
/** Typed appearance from the Studio's normalized wire values (camelCase hooks). */
internal fun parseLivePreviewDialogAppearance(request: JSONObject, field: String) = liveModalFields(request, field)?.let(AWCDialogAppearance::fromValues) ?: AWCDialogAppearance()
internal fun parseLivePreviewBottomSheetAppearance(request: JSONObject, field: String) = liveModalFields(request, field)?.let(AWCBottomSheetAppearance::fromValues) ?: AWCBottomSheetAppearance()
internal fun parseLivePreviewSideSheetAppearance(request: JSONObject, field: String) = liveModalFields(request, field)?.let(AWCSideSheetAppearance::fromValues) ?: AWCSideSheetAppearance()

/** Retained md-dialog / md-bottom-sheet / md-side-sheet property updates with the source property types. */
internal fun parseLivePreviewModalUpdate(request: JSONObject, tag: String): Map<String, AWCValue> {
    require(request.keys().asSequence().all { it in setOf("command", "properties") } && request.optString("command") == "update") { "Expected a modal property update." }
    val properties = request.getJSONObject("properties")
    require(properties.length() > 0) { "A property update must contain at least one field." }
    val booleans: Set<String>; val strings: Set<String>; val enums: Map<String, Set<String>>
    when (tag) {
        "md-dialog" -> { booleans = setOf("open", "fullscreen", "scrimDismissible", "divider", "headerDivider")
            strings = setOf("headline", "dialogAriaLabel", "icon", "locale", "closeLabel", "cancelLabel", "okLabel"); enums = emptyMap() }
        "md-bottom-sheet" -> { booleans = setOf("open", "showDragHandle", "closeable", "scrimDismissible", "topDivider", "bottomDivider", "scrollShadow")
            strings = setOf("headline", "sheetAriaLabel")
            enums = mapOf("variant" to setOf("standard", "detached"), "headlineAlign" to setOf("start", "center", "end"), "contentAlign" to setOf("start", "center", "end")) }
        else -> { booleans = setOf("open", "closeable", "showBack", "scrimDismissible", "topDivider", "bottomDivider", "detached")
            strings = setOf("headline", "sheetAriaLabel"); enums = mapOf("variant" to setOf("standard", "modal"), "side" to setOf("start", "end")) }
    }
    return properties.keys().asSequence().associateWith { name ->
        val value = properties.get(name)
        when {
            name in booleans -> require(value is Boolean) { "$name must be Boolean." }
            name in strings -> require(value is String && value.toByteArray().size <= 4096) { "$name must be a string of at most 4096 UTF-8 bytes." }
            name in enums -> require(value is String && value in enums.getValue(name)) { "Invalid $name." }
            name == "density" -> require(value is Number && value.toDouble() in setOf(0.0, -1.0, -2.0, -3.0, -4.0)) { "Invalid density." }
            else -> throw IllegalArgumentException("Unknown $tag property: $name")
        }
        value
    }
}

/** Lifecycle methods: show, close and whenClosed (md-dialog, md-side-sheet); the source bottom sheet has no whenClosed. */
internal fun validateLivePreviewModalMethod(tag: String, method: String, args: JSONArray): List<String> {
    val allowed = if (tag == "md-bottom-sheet") setOf("show", "close") else setOf("show", "close", "whenClosed")
    require(tag in livePreviewModalTags && method in allowed && args.length() == 0) { "$tag accepts ${allowed.joinToString()} with no arguments." }
    return emptyList()
}

/**
 * The preview viewport as an AWCModalScope, with typed appearance and the controllers bound to the configured component.
 * The web recipe's page content sits under the modal: a tonal launcher that calls show() (`data-awc-action="open"`), inert
 * while a modal is open; its own events stay local.
 */
@Composable
internal fun LivePreviewModalHost(tag: String, width: Double, height: Double, dialog: AWCDialogAppearance, bottomSheet: AWCBottomSheetAppearance, sideSheet: AWCSideSheetAppearance,
                                  dialogController: AWCDialogController, bottomSheetController: AWCBottomSheetController, sideSheetController: AWCSideSheetController,
                                  content: @Composable () -> Unit) {
    AWCModalScope(Modifier.requiredSize(width.toFloat().dp, height.toFloat().dp), insets = WindowInsets(0.dp)) {
        Box(Modifier.fillMaxSize())
        // The recipe's page order: the launcher, then the component. Modal surfaces present in the scope's own layer; a standard
        // side sheet is inline, below the launcher (reading and Tab order as on Web).
        Column {
            Box(Modifier.padding(24.dp)) {
                AWCComponent("md-button", mapOf("label" to "Open " + tag.removePrefix("md-").replace('-', ' '), "variant" to "tonal"), onEvent = { name, _ ->
                    if (name == "mdClick") when (tag) { "md-dialog" -> dialogController.show(); "md-bottom-sheet" -> bottomSheetController.show(); else -> sideSheetController.show() }
                })
            }
            Box(Modifier.padding(start = 24.dp)) {
                AWCDialogAppearanceScope(dialog) { AWCBottomSheetAppearanceScope(bottomSheet) { AWCSideSheetAppearanceScope(sideSheet) {
                    AWCDialogControllerScope(dialogController) { AWCBottomSheetControllerScope(bottomSheetController) { AWCSideSheetControllerScope(sideSheetController) {
                        content()
                    } } }
                } } }
            }
        }
    }
}
