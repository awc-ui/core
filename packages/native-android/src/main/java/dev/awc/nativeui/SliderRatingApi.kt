package dev.awc.nativeui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import kotlin.math.abs

// Public native API of md-slider and md-rating: typed hook appearances (the `--md-slider-*` / `--md-rating-*` custom
// properties, inherited like CSS — nearer values win, the host's own inline `style` wins over all) and md-rating's method
// controller. Lengths are dp (= CSS px), durations ms.

private class SrHookText { val css = LinkedHashMap<String, String>()
    fun n(v: Double) = if (!v.isFinite()) "invalid" else if (v == Math.rint(v) && abs(v) < 1e15) v.toLong().toString() else v.toString()
    fun text(k: String, v: String?) { if (v != null) css[k] = v }
    fun px(k: String, v: Double?) { if (v != null) css[k] = if (v.isFinite()) n(v) + "px" else "invalid" }
    fun plain(k: String, v: Double?) { if (v != null) css[k] = n(v) }
    fun ms(k: String, v: Double?) { if (v != null) css[k] = if (v.isFinite()) n(v) + "ms" else "invalid" }
}
private fun srNum(values: Map<String, AWCValue>, k: String) = (values[k] as? Number)?.toDouble()
/** A numeric property as a Double (Props.num reads Float: 0.35 would become 0.34999999403953552 in the value indicator). */
internal fun Props.srDouble(key: String, fallback: Double = 0.0): Double =
    (this[key] as? Number)?.toDouble() ?: this[key]?.toString()?.trim()?.toDoubleOrNull() ?: fallback
private fun srStr(values: Map<String, AWCValue>, k: String) = values[k] as? String

/** Theme tokens, then the appearance hooks (full names), then the custom properties of the host's inline `style`. */
internal fun awcSrEffectiveTokens(tokens: Map<String, String>, hooks: Map<String, String>, style: String?): Map<String, String> {
    if (hooks.isEmpty() && style.isNullOrBlank()) return tokens
    val out = HashMap(tokens); out.putAll(hooks)
    for (part in style.orEmpty().split(';')) { val i = part.indexOf(':'); if (i > 0) { val k = part.substring(0, i).trim(); if (k.startsWith("--")) out[k] = part.substring(i + 1).trim() } }
    return out
}

/** Typed `--md-slider-*` hooks (24): colours as CSS colour text, lengths in dp, font weight 1…1000. */
class AWCSliderAppearance private constructor(val css: Map<String, String>) {
    constructor(trackLength: Double? = null, activeColor: String? = null, inactiveColor: String? = null, trackShape: Double? = null, trackHeight: Double? = null,
                tickActiveColor: String? = null, tickFilledColor: String? = null, tickInactiveColor: String? = null, thumbColor: String? = null,
                thumbWidth: Double? = null, thumbHeight: Double? = null, valueBackground: String? = null, valueColor: String? = null, valueShape: Double? = null,
                valueFontFamily: String? = null, valueFontSize: Double? = null, valueFontWeight: Double? = null, valueLineHeight: Double? = null,
                valuePaddingInline: Double? = null, valuePaddingBlock: Double? = null, insetIconColor: String? = null, insetIconActiveColor: String? = null,
                minTrackLength: Double? = null, valueIndicatorReserve: Double? = null)
        : this(SrHookText().apply {
            px("track-length", trackLength); text("active-color", activeColor); text("inactive-color", inactiveColor); px("track-shape", trackShape)
            px("track-height", trackHeight); text("tick-active-color", tickActiveColor); text("tick-filled-color", tickFilledColor)
            text("tick-inactive-color", tickInactiveColor); text("thumb-color", thumbColor); px("thumb-width", thumbWidth); px("thumb-height", thumbHeight)
            text("value-bg", valueBackground); text("value-color", valueColor); px("value-shape", valueShape); text("value-font-family", valueFontFamily)
            px("value-font-size", valueFontSize); plain("value-font-weight", valueFontWeight); px("value-line-height", valueLineHeight)
            px("value-padding-inline", valuePaddingInline); px("value-padding-block", valuePaddingBlock); text("inset-icon-color", insetIconColor)
            text("inset-icon-active-color", insetIconActiveColor); px("min-track-length", minTrackLength)
            px("value-indicator-reserve", valueIndicatorReserve) }.css)
    fun merging(o: AWCSliderAppearance) = AWCSliderAppearance(css + o.css)
    fun merge(o: AWCSliderAppearance) = merging(o)
    internal val hooks: Map<String, String> get() = css.mapKeys { "--md-slider-${it.key}" }
    override fun equals(other: Any?) = other is AWCSliderAppearance && other.css == css
    override fun hashCode() = css.hashCode()
    override fun toString() = "AWCSliderAppearance($css)"
    companion object {
        val SUFFIXES = listOf("track-length", "active-color", "inactive-color", "track-shape", "track-height", "tick-active-color", "tick-filled-color",
            "tick-inactive-color", "thumb-color", "thumb-width", "thumb-height", "value-bg", "value-color", "value-shape", "value-font-family", "value-font-size",
            "value-font-weight", "value-line-height", "value-padding-inline", "value-padding-block", "inset-icon-color", "inset-icon-active-color", "min-track-length",
            "value-indicator-reserve")
        fun fromCss(values: Map<String, String>) = AWCSliderAppearance(values.filterKeys { it in SUFFIXES })
        fun fromValues(v: Map<String, AWCValue>) = AWCSliderAppearance(srNum(v, "trackLength"), srStr(v, "activeColor"), srStr(v, "inactiveColor"), srNum(v, "trackShape"),
            srNum(v, "trackHeight"), srStr(v, "tickActiveColor"), srStr(v, "tickFilledColor"), srStr(v, "tickInactiveColor"), srStr(v, "thumbColor"), srNum(v, "thumbWidth"),
            srNum(v, "thumbHeight"), srStr(v, "valueBackground"), srStr(v, "valueColor"), srNum(v, "valueShape"), srStr(v, "valueFontFamily"), srNum(v, "valueFontSize"),
            srNum(v, "valueFontWeight"), srNum(v, "valueLineHeight"), srNum(v, "valuePaddingInline"), srNum(v, "valuePaddingBlock"), srStr(v, "insetIconColor"),
            srStr(v, "insetIconActiveColor"), srNum(v, "minTrackLength"), srNum(v, "valueIndicatorReserve"))
    }
}

/** Typed `--md-rating-*` hooks (13): colours, lengths in dp, `valueLabelFont` a CSS `font` shorthand, `popScale`, `duration` (ms), `iconFontFamily`. */
class AWCRatingAppearance private constructor(val css: Map<String, String>) {
    constructor(itemSize: Double? = null, itemGap: Double? = null, activeColor: String? = null, inactiveColor: String? = null, focusRingColor: String? = null,
                focusRingWidth: Double? = null, focusRingOffset: Double? = null, stateLayerColor: String? = null, valueLabelColor: String? = null,
                valueLabelFont: String? = null, popScale: Double? = null, duration: Double? = null, iconFontFamily: String? = null)
        : this(SrHookText().apply {
            px("item-size", itemSize); px("item-gap", itemGap); text("active-color", activeColor); text("inactive-color", inactiveColor)
            text("focus-ring-color", focusRingColor); px("focus-ring-width", focusRingWidth); px("focus-ring-offset", focusRingOffset)
            text("state-layer-color", stateLayerColor); text("value-label-color", valueLabelColor); text("value-label-font", valueLabelFont)
            plain("pop-scale", popScale); ms("duration", duration); text("icon-font-family", iconFontFamily) }.css)
    fun merging(o: AWCRatingAppearance) = AWCRatingAppearance(css + o.css)
    fun merge(o: AWCRatingAppearance) = merging(o)
    internal val hooks: Map<String, String> get() = css.mapKeys { "--md-rating-${it.key}" }
    override fun equals(other: Any?) = other is AWCRatingAppearance && other.css == css
    override fun hashCode() = css.hashCode()
    override fun toString() = "AWCRatingAppearance($css)"
    companion object {
        val SUFFIXES = listOf("item-size", "item-gap", "active-color", "inactive-color", "focus-ring-color", "focus-ring-width", "focus-ring-offset",
            "state-layer-color", "value-label-color", "value-label-font", "pop-scale", "duration", "icon-font-family")
        fun fromCss(values: Map<String, String>) = AWCRatingAppearance(values.filterKeys { it in SUFFIXES })
        fun fromValues(v: Map<String, AWCValue>) = AWCRatingAppearance(srNum(v, "itemSize"), srNum(v, "itemGap"), srStr(v, "activeColor"), srStr(v, "inactiveColor"),
            srStr(v, "focusRingColor"), srNum(v, "focusRingWidth"), srNum(v, "focusRingOffset"), srStr(v, "stateLayerColor"), srStr(v, "valueLabelColor"),
            srStr(v, "valueLabelFont"), srNum(v, "popScale"), srNum(v, "duration"), srStr(v, "iconFontFamily"))
    }
}

/** md-rating's method: focusRating() moves keyboard focus to the rating. */
class AWCRatingController {
    internal var focus: (() -> Unit)? = null
    /** The source's `getLabel` property: the value's text for the value label and the accessible value (null: "N Stars"). */
    var getLabel: ((Double) -> String)? by androidx.compose.runtime.mutableStateOf<((Double) -> String)?>(null)
    val isConnected: Boolean get() = focus != null
    fun focusRating() { focus?.invoke() }
}

internal val LocalAWCSliderAppearance = staticCompositionLocalOf { AWCSliderAppearance() }
internal val LocalAWCRatingAppearance = staticCompositionLocalOf { AWCRatingAppearance() }
internal val LocalAWCRatingController = staticCompositionLocalOf<AWCRatingController?> { null }

/** Applies md-slider hook values to the sliders below. */
@Composable fun AWCSliderAppearanceScope(appearance: AWCSliderAppearance, content: @Composable () -> Unit) =
    CompositionLocalProvider(LocalAWCSliderAppearance provides LocalAWCSliderAppearance.current.merging(appearance), content = content)
/** Applies md-rating hook values to the ratings below. */
@Composable fun AWCRatingAppearanceScope(appearance: AWCRatingAppearance, content: @Composable () -> Unit) =
    CompositionLocalProvider(LocalAWCRatingAppearance provides LocalAWCRatingAppearance.current.merging(appearance), content = content)
/** Binds focusRating() to the rating below. */
@Composable fun AWCRatingControllerScope(controller: AWCRatingController, content: @Composable () -> Unit) =
    CompositionLocalProvider(LocalAWCRatingController provides controller, content = content)
