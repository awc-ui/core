package dev.awc.nativeui

import android.view.PointerIcon as AndroidPointerIcon
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.PointerIcon
import androidx.compose.ui.input.pointer.pointerHoverIcon
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.ui.platform.LocalContext

/**
 * The CSS `cursor` values the AWC sources declare, mapped to Android system pointer icons. The innermost
 * styled node wins (Compose resolves the deepest `pointerHoverIcon`), as the innermost element's `cursor` does in CSS.
 */
enum class AWCCursorStyle(val css: String, val androidType: Int) {
    Pointer("pointer", AndroidPointerIcon.TYPE_HAND),
    Default("default", AndroidPointerIcon.TYPE_ARROW),
    Grab("grab", AndroidPointerIcon.TYPE_GRAB),
    Grabbing("grabbing", AndroidPointerIcon.TYPE_GRABBING),
    NotAllowed("not-allowed", AndroidPointerIcon.TYPE_NO_DROP),
    Text("text", AndroidPointerIcon.TYPE_TEXT),
    Crosshair("crosshair", AndroidPointerIcon.TYPE_CROSSHAIR),
    EwResize("ew-resize", AndroidPointerIcon.TYPE_HORIZONTAL_DOUBLE_ARROW);
    companion object {
        /** Parses a computed CSS cursor; `auto`/`inherit`/unknown → null (no own cursor). */
        fun fromCss(value: String): AWCCursorStyle? = entries.firstOrNull { it.css == value.trim().lowercase() }
    }
}

/**
 * Applies a source CSS `cursor` over this node's bounds; null = no own cursor. [stable] keeps the hover-icon node in the
 * chain when the style toggles to null (the system default icon then): adding or removing the node while the pointer
 * is over it restarts the hover tracking of the content (e.g. a header's hover state layer during a drag).
 */
@Composable
fun Modifier.awcCursor(style: AWCCursorStyle?, stable: Boolean = false): Modifier {
    if (style == null && !stable) return this
    val context = LocalContext.current
    return this.pointerHoverIcon(PointerIcon(AndroidPointerIcon.getSystemIcon(context, (style ?: AWCCursorStyle.Default).androidType)))
}

/** Host-level `cursor` rules of the sources, applied by the shared dispatch. Hard-disabled hosts set `pointer-events: none`
 * (no own cursor: the content beneath shows through); `[soft-disabled]` restores events with `cursor: default`. */
fun awcHostCursor(tag: String, p: Map<String, AWCValue>): AWCCursorStyle? {
    fun b(k: String) = p[k] == true
    val disabled = b("disabled"); val soft = b("softDisabled") && !disabled
    return when (tag) {
        "md-button", "md-icon-button", "md-fab", "md-fab-menu-item", "md-checkbox", "md-switch", "md-radio", "md-chip",
        "md-segmented-button", "md-split-button" -> if (disabled) null else if (soft) AWCCursorStyle.Default else AWCCursorStyle.Pointer
        "md-menu-item", "md-sub-menu-item", "md-tab", "md-navigation-rail-tab", "md-table-sort-label" -> if (disabled) null else AWCCursorStyle.Pointer
        "md-navigation-tab" -> if (disabled) null else if (soft) AWCCursorStyle.NotAllowed else AWCCursorStyle.Pointer
        // `.md-slider__input { cursor: pointer }` covers the control even when the host is disabled (`not-allowed`).
        "md-slider" -> AWCCursorStyle.Pointer
        "md-table-row" -> if (b("clickable")) AWCCursorStyle.Pointer else null
        "md-time-picker" -> if (disabled) AWCCursorStyle.NotAllowed else null
        else -> null
    }
}

/** One source `cursor` declaration: applies when [applies]; the CSS cascade picks the highest (specificity, order). */
class AWCCursorRule(val applies: Boolean, val specificity: Int, val order: Int, val style: AWCCursorStyle)

/** Resolves source `cursor` rules like the CSS cascade; null when none applies (the element inherits). */
fun awcCursorCascade(vararg rules: AWCCursorRule): AWCCursorStyle? =
    rules.filter { it.applies }.maxWithOrNull(compareBy<AWCCursorRule>({ it.specificity }, { it.order }))?.style

/** Observes a press on this node without consuming it (CSS `:active` of the element itself, e.g. a grab handle). */
fun Modifier.awcActiveObserver(onActive: (Boolean) -> Unit): Modifier = this.pointerInput(Unit) {
    awaitEachGesture {
        awaitFirstDown(requireUnconsumed = false, pass = androidx.compose.ui.input.pointer.PointerEventPass.Initial)
        onActive(true)
        do { val e = awaitPointerEvent(androidx.compose.ui.input.pointer.PointerEventPass.Initial) } while (e.changes.any { it.pressed })
        onActive(false)
    }
}

/** Tags whose renderers handle `hidden` themselves (their parents coordinate display:none members, or they keep tracking). */
internal val AWCSelfHiddenTags = setOf("md-navigation-rail-tab", "md-accordion-item", "md-list-item", "md-ripple", "md-breadcrumb-item", "md-navigation-tab",
    "md-tab", "md-tab-panel", "md-toolbar")
