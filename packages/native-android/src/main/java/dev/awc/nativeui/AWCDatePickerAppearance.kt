package dev.awc.nativeui

import androidx.compose.runtime.*

// md-date-picker hooks (the source's `--md-date-picker-*` custom properties), the pinned "today", the controller and the
// resolved geometry: a port of AWCUI's DatePickerAppearance.swift.

/** Hook suffix (`"container-color"`) or full name (`"--md-date-picker-container-color"`) → CSS value. */
@Immutable data class AWCDatePickerAppearance(val hooks: Map<String, String> = emptyMap()) {
    val values: Map<String, String> = hooks.entries.mapNotNull { (k, v) ->
        val key = k.removePrefix("--md-date-picker-"); val t = v.trim(); if (t.isEmpty()) null else key to t }.toMap()
    fun merge(o: AWCDatePickerAppearance) = AWCDatePickerAppearance(values + o.values)
    internal fun raw(k: String): String? = values[k]
    /** A colour hook as #RRGGBB[AA]. */
    internal fun color(k: String): String? = values[k]?.let(::awcTimePickerColor)
    /** A length hook in px (unitless numbers allowed). */
    internal fun length(k: String): Double? {
        val t = values[k]?.lowercase() ?: return null
        return (if (t.endsWith("px")) t.dropLast(2).trim().toDoubleOrNull() else t.toDoubleOrNull())?.takeIf { it.isFinite() }
    }
    /** A duration hook in ms (ms / s). */
    internal fun duration(k: String): Double? {
        val t = values[k]?.lowercase()?.trim() ?: return null
        return (if (t.endsWith("ms")) t.dropLast(2).trim().toDoubleOrNull() else if (t.endsWith("s")) t.dropLast(1).trim().toDoubleOrNull()?.times(1000) else null)?.takeIf { it.isFinite() && it >= 0 }
    }
    /** An easing hook as cubic-bezier control values (x1, y1, x2, y2; x in 0…1). */
    internal fun easing(k: String): List<Double>? {
        val t = values[k]?.lowercase()?.trim() ?: return null
        if (!t.startsWith("cubic-bezier(") || !t.endsWith(")")) return null
        val v = t.substring(13, t.length - 1).split(',').mapNotNull { it.trim().toDoubleOrNull() }
        return v.takeIf { it.size == 4 && it.all(Double::isFinite) && it[0] in 0.0..1.0 && it[2] in 0.0..1.0 }
    }
    companion object {
        /** A hook map from the Laboratory / JSON: keys by hook name in camel or kebab case, values as CSS text (numbers are px). */
        fun fromValues(values: Map<String, Any?>) = AWCDatePickerAppearance(values.mapNotNull { (name, value) ->
            val key = buildString { for (c in name) if (c.isUpperCase()) { append('-'); append(c.lowercaseChar()) } else append(c) }
            when (value) { is String -> key to value; is Number -> key to value.toString(); else -> null } }.toMap())
        /** `style` declarations (`--md-date-picker-x: v; …`). */
        fun fromStyle(style: String) = AWCDatePickerAppearance(style.split(';').mapNotNull { d ->
            val p = d.split(':', limit = 2).map { it.trim() }; if (p.size == 2 && p[0].startsWith("--md-date-picker-")) p[0] to p[1] else null }.toMap())
    }
}
internal val LocalAWCDatePickerAppearance = compositionLocalOf { AWCDatePickerAppearance() }
internal val LocalAWCDatePickerAppearanceTargets = compositionLocalOf { emptyMap<String, AWCDatePickerAppearance>() }
internal val LocalAWCDatePickerToday = compositionLocalOf<AWCDay?> { null }
internal val LocalAWCDatePickerController = compositionLocalOf<AWCDatePickerController?> { null }

/** Hook values for descendant pickers, or for the picker with id [id]. */
@Composable fun AWCDatePickerAppearanceScope(appearance: AWCDatePickerAppearance, id: String? = null, content: @Composable () -> Unit) {
    if (id == null) CompositionLocalProvider(LocalAWCDatePickerAppearance provides LocalAWCDatePickerAppearance.current.merge(appearance), content = content)
    else { val t = LocalAWCDatePickerAppearanceTargets.current
        CompositionLocalProvider(LocalAWCDatePickerAppearanceTargets provides t + (id to (t[id] ?: AWCDatePickerAppearance()).merge(appearance)), content = content) }
}
/** Pins the calendar's "today" (tests, previews, a server-supplied date). */
@Composable fun AWCDatePickerTodayScope(day: AWCDay?, content: @Composable () -> Unit) = CompositionLocalProvider(LocalAWCDatePickerToday provides day, content = content)
@Composable fun AWCDatePickerControllerScope(controller: AWCDatePickerController, content: @Composable () -> Unit) =
    CompositionLocalProvider(LocalAWCDatePickerController provides controller, content = content)

/** Native counterpart of md-date-picker's methods. */
class AWCDatePickerController {
    internal var runtime: AWCDatePickerRuntime? = null
    /** `isDateDisabled`: days it returns true for are disabled (the source's per-cell predicate). */
    var isDateDisabled: ((AWCDay) -> Boolean)? = null
    val isConnected get() = runtime != null
    fun show() { runtime?.show?.invoke() }
    fun close() { runtime?.hide?.invoke() }
    fun clear() { runtime?.clear?.invoke() }
    fun focusInput() { runtime?.focusInput?.invoke() }
    /** The committed value's validity (`required`, a custom message): `{ valid, validationMessage, flags }` with the failing flag. */
    fun getValidity(): AWCDatePickerValidity = runtime?.let { r ->
        AWCDatePickerValidity(r.validityMessage.isEmpty(), r.validityMessage, r.validityFlag == "valueMissing", r.validityFlag == "customError") } ?: AWCDatePickerValidity()
    /** Validity without presenting it; a disabled picker is barred from validation and reports true. */
    fun checkValidity(): Boolean = runtime?.let { it.isDisabled() || it.validityMessage.isEmpty() } ?: true
    /** Like [checkValidity], but an invalid picker shows its message as the field's error text and focuses the field. */
    fun reportValidity(): Boolean {
        val r = runtime ?: return true
        if (r.isDisabled() || r.validityMessage.isEmpty()) return true
        r.revealed = true; r.focusInput(); return false
    }
    /** A non-empty message makes the picker invalid (`customError`) until it is cleared with "". */
    fun setCustomValidity(message: String) { runtime?.let { it.customValidity = message; it.revalidate() } }
}
/** md-date-picker's constraint validity, as the source's `getValidity()` record (`flags` holds the failing reasons only). */
data class AWCDatePickerValidity(val valid: Boolean = true, val validationMessage: String = "", val valueMissing: Boolean = false, val customError: Boolean = false) {
    val value: Map<String, Any?> get() = mapOf("valid" to valid, "validationMessage" to validationMessage,
        "flags" to buildMap<String, Any?> { if (valueMissing) put("valueMissing", true); if (customError) put("customError", true) })
}

/** Resolved geometry for a density scale (`--md-sys-density-scale`) and spacing rung (the `[density]` token rung). */
internal class DPMetrics(a: AWCDatePickerAppearance, val scale: Double, val rung: Double) {
    private val d = scale; private val r = rung
    val daySize = max2(28.0, 40 + d * 3); val gridGap = max2(2.0, 6 + d); val weekdaySize = 24.0
    val weekdayFont = max2(13.0, 16 + d * .5); val dayFont = weekdayFont
    val panelWidth = a.length("panel-width") ?: max2(288.0, 380 + d * 20)
    val panelMax = a.length("panel-max-block-size") ?: 524.0
    val dockedWidth = a.length("docked-panel-width") ?: max2(360 + d * 10, panelWidth)
    val iconSize = a.length("icon-size") ?: max2(18.0, 24 + d)
    val shape = a.length("container-shape") ?: 28.0
    val yearWidth = a.length("year-inline-size") ?: max2(48.0, 72 + d * 6); val yearHeight = a.length("year-block-size") ?: max2(24.0, 36 + d * 3)
    val yearGap = a.length("year-grid-gap") ?: max2(4.0, 12 + d * 2); val yearPadInline = a.length("year-grid-padding-inline") ?: 30.0
    val yearViewport = a.length("year-grid-viewport-block-size") ?: max2(180.0, 288 + d * 24)
    val insetXs = 4.0; val insetSm = if (r <= -3) 4.0 else 8.0; val insetMd = if (r <= -2) 8.0 else 12.0
    val insetLg = if (r <= -4) 8.0 else if (r <= -2) 12.0 else 16.0; val insetXl = if (r <= -3) 16.0 else if (r <= -2) 20.0 else 24.0
    val gapXs = if (r <= -4) 2.0 else 4.0; val gapSm = if (r <= -3) 4.0 else 8.0; val gapLg = if (r <= -4) 8.0 else if (r <= -2) 12.0 else 16.0
    val supportingFont = max2(10.0, 12 + d * .5); val supportingLine = max2(14.0, 16 + d * .5); val supportingPad = max2(4.0, 36 + d * 6)
    val headlineFont = max2(24.0, 32 + d * 2); val headlineLine = max2(30.0, 40 + d * 2.5); val rowMin = max2(28.0, 40 + d * 3)
    val menuFont = max2(12.0, 14 + d * .5); val menuLine = max2(16.0, 20 + d); val caret = max2(16.0, 20 + d)
    val actionsMin = max2(28.0, 40 + d * 3); val dockedTop = max2(4.0, 20 + d * 2)
    val triggerMax = a.length("trigger-max-width") ?: 360.0
    /** Day grid height: 6 rows and 5 gaps. */
    val gridHeight get() = 6 * daySize + 5 * gridGap
    private companion object { fun max2(a: Double, b: Double) = if (a > b) a else b }
}
