package dev.awc.nativeui.rating

import dev.awc.nativeui.slider.SrRgba
import dev.awc.nativeui.slider.SrTextMeasurer
import dev.awc.nativeui.slider.srCubicBezier
import dev.awc.nativeui.slider.srParseColor
import dev.awc.nativeui.slider.SliderMotion
import dev.awc.nativeui.slider.SliderRect
import dev.awc.nativeui.slider.sliderColorMix
import kotlin.math.ceil
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sqrt

// md-rating.css as a geometry + colour model: the host row (items + value label), each item box with its glyph
// layers (empty / filled with the inline-start clip / state layer / press ripple), the hover pop, the focus ring
// and the value label, resolved the way Chrome lays them out. The Compose and SwiftUI views draw exactly these;
// the paint harness compares them with the Chrome capture.

/** The md-sys tokens md-rating reads. */
data class RatingTheme(
    val secondary: String, val onSurface: String, val onSurfaceVariant: String,
    /** Page density (0 … -4) and the spacing rung that came with it. */
    val densityScale: Double = 0.0, val gapXs: Double = 4.0, val gapMd: Double = 12.0,
    val labelFontFamily: String = "Roboto", val labelLineHeight: Double = 16.0,
    val disabledContentOpacity: Double = 0.38, val hoverOpacity: Double = 0.08, val pressedOpacity: Double = 0.12,
    val durationShort3Ms: Double = 150.0, val easingEmphasized: (Double) -> Double = srCubicBezier(0.2, 0.0, 0.0, 1.0),
    val ease: (Double) -> Double = srCubicBezier(0.25, 0.1, 0.25, 1.0),
    /** --md-sys-ripple-enabled: "0" turns the press ripple off. */
    val rippleEnabled: Boolean = true,
)

/** The public `--md-rating-*` custom properties (null = not set). */
data class RatingHooks(
    val itemSize: Double? = null, val itemGap: Double? = null, val activeColor: String? = null, val inactiveColor: String? = null,
    val focusRingColor: String? = null, val focusRingWidth: Double? = null, val focusRingOffset: Double? = null,
    val stateLayerColor: String? = null, val valueLabelColor: String? = null,
    /** --md-rating-value-label-font is a `font` shorthand: only its family and line-height survive (size / weight are re-set). */
    val valueLabelFontFamily: String? = null, val valueLabelLineHeight: Double? = null,
    val popScale: Double? = null, val durationMs: Double? = null,
    /** ::part(value-label) only (no hook sets them): font size / weight and letter spacing of the value label. */
    val valueLabelFontSize: Double? = null, val valueLabelFontWeight: Double? = null, val valueLabelLetterSpacing: Double? = null,
    /** ::part(icon-filled) colour: the filled glyph only (the host's colour stays the active colour). */
    val iconFilledColor: String? = null,
    /** ::part(item) width / height: the item box (the glyph keeps --_size, centred in it). */
    val itemBox: Double? = null,
)

/** A press ripple: started at `start` (ms) at (x %, y %) of the item, 420 ms emphasized, circle 0 → 85 %, opacity .22 → 0. */
data class RatingRipple(val item: Int, val start: Double, val xPct: Double, val yPct: Double)

data class RatingItemPaint(
    val index: Int, val rect: SliderRect, val kind: String,
    /** The filled glyph's clip: `clipPct` % cut from the inline-end side (the right in LTR, the left in RTL). */
    val fill: Double, val clipPct: Double, val clipFromLeft: Boolean,
    val scale: Double, val stateOpacity: Double,
    /** The state layer and ripple are display:none unless the rating is interactive. */
    val stateVisible: Boolean,
    /** Active ripple: circle radius as a % of the item's reference radius (√(w²+h²)/√2), its centre and opacity. */
    val rippleRadiusPct: Double?, val rippleXPct: Double, val rippleYPct: Double, val rippleOpacity: Double,
)
data class RatingPaint(
    val width: Double, val height: Double, val opacity: Double,
    val items: SliderRect, val itemList: List<RatingItemPaint>,
    val icon: String, val emptyIcon: String,
    /** Glyph axes: the empty layer is FILL 0 / wght 500 with outline-empty, else FILL 1 / wght 400; the filled layer FILL 1 / wght 500. */
    val emptyFill: Int, val emptyWeight: Int, val glyphSize: Double,
    val activeColor: SrRgba, val inactiveColor: SrRgba, val stateLayerColor: SrRgba,
    /** The filled glyph's colour when ::part(icon-filled) sets one (null: the active colour). */
    val iconColor: SrRgba? = null,
    val focusRing: Boolean, val focusRingColor: SrRgba, val focusRingWidth: Double, val focusRingOffset: Double,
    val label: SliderRect?, val labelText: String?, val labelColor: SrRgba, val labelFontFamily: String,
    val labelFontSize: Double, val labelFontWeight: Double, val labelLineHeight: Double,
    val labelLetterSpacing: Double = 0.0,
)

private fun luCeil(x: Double): Double = ceil(x.toFloat().toDouble() * 64) / 64

/** tokens.css: the gaps a local `density` rung re-declares on the host (gap-xs, gap-md). */
private fun gapsForRung(d: Int): Pair<Double, Double> = when (d) { -2, -3 -> 4.0 to 8.0; -4 -> 2.0 to 4.0; else -> 4.0 to 12.0 }

object RatingLayout {
    private fun base(size: String) = when (size) { "xs" -> 16.0; "sm" -> 20.0; "lg" -> 36.0; "xl" -> 48.0; else -> 28.0 }

    /**
     * @param hoverItem the item under the pointer (`:hover`, -1 none); @param pressedItem the item held down (`:active`).
     * @param motion transition state (call once per frame with `now`, ms); null = settled.
     */
    fun layout(
        r: RatingInteraction, theme: RatingTheme, hooks: RatingHooks, measurer: SrTextMeasurer,
        size: String = "md", icon: String = "star", emptyIcon: String = "star", outlineEmpty: Boolean = true,
        showValueLabel: Boolean = false, densityProp: Int? = null,
        hoverItem: Int = -1, pressedItem: Int = -1, ripples: List<RatingRipple> = emptyList(),
        reducedMotion: Boolean = false, motion: SliderMotion? = null, now: Double = 0.0,
    ): RatingPaint {
        val rung = densityProp?.takeIf { it in -4..-1 }
        val d = rung?.toDouble() ?: theme.densityScale
        val (gapXs, gapMd) = if (rung != null) gapsForRung(rung) else theme.gapXs to theme.gapMd
        val glyph = hooks.itemSize ?: max(12.0, base(size) + d * 2)
        val itemSize = hooks.itemBox ?: glyph      // the item box (::part(item) width / height); the glyph keeps --_size
        val gap = hooks.itemGap ?: gapXs
        val c = { css: String -> srParseColor(css) }
        val active = c(hooks.activeColor ?: theme.secondary)
        val inactive = hooks.inactiveColor?.let(c) ?: sliderColorMix(c(theme.onSurfaceVariant), 0.30, SrRgba(0.0, 0.0, 0.0, 0.0))
        val stateColor = c(hooks.stateLayerColor ?: theme.onSurface)
        val labelColor = c(hooks.valueLabelColor ?: theme.onSurface)
        val n = r.max
        val itemsW = n * itemSize + max(0, n - 1) * gap
        // Value label: an inline grid stacking the hidden sizers (every step's label) under the visible text.
        val labelFont = hooks.valueLabelFontSize ?: 14.0; val labelWeight = hooks.valueLabelFontWeight ?: 500.0; val labelSpacing = hooks.valueLabelLetterSpacing ?: 0.0
        val labelLine = hooks.valueLabelLineHeight ?: theme.labelLineHeight
        val labelText = if (showValueLabel) r.label(r.displayValue) else null
        val labelW = if (!showValueLabel) 0.0 else (r.labelVariants() + labelText!!).maxOf { luCeil(measurer.width(it, labelFont, labelWeight) + labelSpacing * it.length) }
        val hostW = itemsW + if (showValueLabel) gapMd + labelW else 0.0
        val hostH = max(itemSize, if (showValueLabel) labelLine else 0.0)
        val rtl = r.rtl
        val itemsX = if (rtl) hostW - itemsW else 0.0
        val items = SliderRect(itemsX, (hostH - itemSize) / 2, itemsW, itemSize)
        val label = if (!showValueLabel) null else SliderRect(if (rtl) 0.0 else hostW - labelW, (hostH - labelLine) / 2, labelW, labelLine)

        val interactive = r.isInteractive
        val pop = hooks.popScale ?: 1.12
        val dur = hooks.durationMs ?: theme.durationShort3Ms
        val list = (0 until n).map { i ->
            val x = if (rtl) itemsX + itemsW - (i + 1) * itemSize - i * gap else itemsX + i * (itemSize + gap)
            val fill = r.fill(i)
            // :hover pops the item (not when inert or under reduced motion); the state layer tints it (pressed > hover).
            // Readonly still hovers (its state layer is display:none, so the tint is computed but not drawn);
            // disabled / soft-disabled items take no pointer at all.
            val hoverable = !r.disabled && !r.softDisabled
            var scale = if (interactive && hoverItem == i && !reducedMotion) pop else 1.0
            var state = if (!hoverable) 0.0 else if (pressedItem == i) theme.pressedOpacity else if (hoverItem == i) theme.hoverOpacity else 0.0
            if (motion != null) {
                scale = motion.animate("item$i-scale", scale, now, if (reducedMotion) 0.0 else dur, theme.easingEmphasized)
                // A display:none state layer (readonly) has no transitions: its computed opacity switches at once.
                state = motion.animate("item$i-state", state, now, if (reducedMotion || !interactive) 0.0 else dur, theme.ease)
            }
            // (Frame times are coarse: a ripple counts from half a millisecond before its start.)
            val rp = ripples.lastOrNull { it.item == i && interactive && theme.rippleEnabled && now >= it.start - 0.5 && now < it.start + 420 }
            val e = rp?.let { theme.easingEmphasized(max(0.0, min(1.0, (now - it.start) / 420))) }
            RatingItemPaint(i, SliderRect(x, items.y, itemSize, itemSize), r.itemState(i), fill, (1 - fill) * 100, rtl, scale, state, interactive,
                e?.let { 85 * it }, rp?.xPct ?: 50.0, rp?.yPct ?: 50.0, e?.let { 0.22 * (1 - it) } ?: 0.0)
        }
        return RatingPaint(
            width = hostW, height = hostH, opacity = if (r.disabled || r.softDisabled) theme.disabledContentOpacity else 1.0,
            items = items, itemList = list, icon = icon, emptyIcon = if (outlineEmpty) icon else emptyIcon,
            emptyFill = if (outlineEmpty) 0 else 1, emptyWeight = if (outlineEmpty) 500 else 400, glyphSize = glyph,
            activeColor = active, inactiveColor = inactive, stateLayerColor = stateColor, iconColor = hooks.iconFilledColor?.let(c),
            focusRing = r.focused && r.focusVisible, focusRingColor = c(hooks.focusRingColor ?: theme.secondary),
            focusRingWidth = hooks.focusRingWidth ?: 3.0, focusRingOffset = hooks.focusRingOffset ?: 2.0,
            label = label, labelText = labelText, labelColor = labelColor, labelFontFamily = hooks.valueLabelFontFamily ?: theme.labelFontFamily,
            labelFontSize = labelFont, labelFontWeight = labelWeight, labelLineHeight = labelLine, labelLetterSpacing = labelSpacing,
        )
    }

    /** The ripple circle's radius in px for an item box (CSS `circle(r%)` resolves against √(w²+h²)/√2). */
    fun rippleRadiusPx(pct: Double, w: Double, h: Double) = pct / 100 * sqrt(w * w + h * h) / sqrt(2.0)
}
