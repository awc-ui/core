package dev.awc.nativeui

import androidx.compose.runtime.*
import dev.awc.nativeui.slider.*
import kotlin.math.max
import kotlin.math.min

/**
 * md-slider's exported shadow parts (`md-slider::part(<name>)`), typed as [AWCAccordionPartAppearance] (as md-list /
 * md-accordion) and applied with the source's CSS semantics per part — see `AWCSliderPart` in SliderRatingParts.swift:
 * track (corner shape), track-active / track-inactive (background, corner shape, block size from the track's start edge),
 * thumb-knob (background, size around the thumb centre), value-indicator (background, colour, font, padding, corner shape),
 * inset (colour), surface (opacity); state-layer is hidden by the source in every state.
 */
enum class AWCSliderPart(val source: String) {
    Surface("surface"), Track("track"), TrackActive("track-active"), TrackInactive("track-inactive"), StateLayer("state-layer"),
    ThumbKnob("thumb-knob"), ValueIndicator("value-indicator"), Inset("inset");
    companion object { fun fromSource(name: String) = entries.firstOrNull { it.source == name } }
}

internal val LocalAWCSliderParts = staticCompositionLocalOf { emptyMap<AWCSliderPart, AWCAccordionPartAppearance>() }

/** Part styling inherits into nested scopes (nearer values win). */
@Composable fun AWCSliderPartAppearanceScope(part: AWCSliderPart, appearance: AWCAccordionPartAppearance, content: @Composable () -> Unit) {
    val inherited = LocalAWCSliderParts.current
    val resolved = remember(inherited, part, appearance) { inherited + (part to (inherited[part] ?: AWCAccordionPartAppearance()).merged(appearance)) }
    CompositionLocalProvider(LocalAWCSliderParts provides resolved, content = content)
}

object SliderParts {
    /** CSS border-radius on a w×h box: lengths + percentages, scaled down together when adjacent radii overflow. */
    fun radii(s: AWCCornerShape?, w: Double, h: Double): SliderRadii? {
        s ?: return null
        fun r(c: AWCCornerRadius) = max(0.0, c.x.points + c.x.fraction * w)
        val t = SliderRadii(r(s.topLeft), r(s.topRight), r(s.bottomRight), r(s.bottomLeft))
        val f = listOf(w / (t.tl + t.tr), w / (t.bl + t.br), h / (t.tl + t.bl), h / (t.tr + t.br)).filter { it.isFinite() }.fold(1.0, ::min)
        return if (f < 1) SliderRadii(t.tl * f, t.tr * f, t.br * f, t.bl * f) else t
    }
    /** The value-indicator part feeds the layout through the value hooks it overrides. */
    fun hooks(h: SliderHooks, parts: Map<AWCSliderPart, AWCAccordionPartAppearance>): SliderHooks {
        val v = parts[AWCSliderPart.ValueIndicator] ?: return h
        return h.copy(valueBg = v.backgroundColor ?: h.valueBg, valueColor = v.color ?: h.valueColor, valueFontSize = v.fontSize ?: h.valueFontSize,
            valueFontWeight = v.fontWeight ?: h.valueFontWeight, valueLineHeight = v.lineHeight ?: h.valueLineHeight,
            valuePaddingInline = v.padding?.left ?: h.valuePaddingInline, valuePaddingBlock = v.padding?.top ?: h.valuePaddingBlock,
            valueShape = v.cornerShape?.topLeft?.x?.points ?: h.valueShape)
    }
    /** The painted parts after the part rules (every overridden box keeps its CSS anchor). */
    fun applied(paint: SliderPaint, parts: Map<AWCSliderPart, AWCAccordionPartAppearance>, vertical: Boolean): SliderPaint {
        if (parts.isEmpty()) return paint
        fun rgba(hex: String?) = hex?.let { srParseColor(it) }
        var p = paint
        parts[AWCSliderPart.Surface]?.opacity?.let { p = p.copy(opacity = p.opacity * it) }
        radii(parts[AWCSliderPart.Track]?.cornerShape, p.track.width, p.track.height)?.let { p = p.copy(trackRadius = it.tl) }
        p = p.copy(segments = p.segments.map { sg ->
            val part = when (sg.kind) { "active" -> AWCSliderPart.TrackActive; "inactive" -> AWCSliderPart.TrackInactive; else -> null }
            val a = part?.let { parts[it] } ?: return@map sg
            var rect = sg.rect
            if (!vertical) a.height?.let { rect = rect.copy(height = it) }
            if (vertical) a.width?.let { rect = rect.copy(width = it) }
            sg.copy(rect = rect, color = rgba(a.backgroundColor) ?: sg.color, radii = radii(a.cornerShape, rect.width, rect.height) ?: sg.radii)
        })
        parts[AWCSliderPart.ThumbKnob]?.let { a ->
            p = p.copy(thumbs = p.thumbs.map { t ->
                val k = t.knob; val cx = k.x + k.width / 2; val cy = k.y + k.height / 2
                val w = a.width ?: k.width; val h = a.height ?: k.height
                t.copy(knob = SliderRect(cx - w / 2, cy - h / 2, w, h), knobColor = rgba(a.backgroundColor) ?: t.knobColor)
            })
        }
        parts[AWCSliderPart.ValueIndicator]?.letterSpacing?.let { ls -> p = p.copy(indicators = p.indicators.map { it.copy(letterSpacing = ls) }) }
        rgba(parts[AWCSliderPart.Inset]?.color)?.let { c -> p.inset?.let { p = p.copy(inset = it.copy(color = c)) } }
        return p
    }
}

/**
 * md-rating's exported shadow parts, applied through the values they override (see `AWCRatingPart` in
 * SliderRatingParts.swift): items (gap), item (width / height = the item box; the glyph keeps the item size), icon-filled / icon-empty (colour), state-layer
 * (background colour), value-label (colour, font size / weight / line height, letter spacing), ripple (md-ripple's surface).
 */
enum class AWCRatingPart(val source: String) {
    Items("items"), Item("item"), IconFilled("icon-filled"), IconEmpty("icon-empty"), StateLayer("state-layer"), Ripple("ripple"), ValueLabel("value-label");
    companion object { fun fromSource(name: String) = entries.firstOrNull { it.source == name } }
}
internal val LocalAWCRatingParts = staticCompositionLocalOf { emptyMap<AWCRatingPart, AWCAccordionPartAppearance>() }
@Composable fun AWCRatingPartAppearanceScope(part: AWCRatingPart, appearance: AWCAccordionPartAppearance, content: @Composable () -> Unit) {
    val inherited = LocalAWCRatingParts.current
    val resolved = remember(inherited, part, appearance) { inherited + (part to (inherited[part] ?: AWCAccordionPartAppearance()).merged(appearance)) }
    CompositionLocalProvider(LocalAWCRatingParts provides resolved, content = content)
}
object RatingParts {
    fun hooks(h: dev.awc.nativeui.rating.RatingHooks, parts: Map<AWCRatingPart, AWCAccordionPartAppearance>): dev.awc.nativeui.rating.RatingHooks {
        if (parts.isEmpty()) return h
        val v = parts[AWCRatingPart.ValueLabel]; val it = parts[AWCRatingPart.Item]
        return h.copy(itemGap = parts[AWCRatingPart.Items]?.gap ?: h.itemGap, itemBox = it?.width ?: it?.height ?: h.itemBox,
            iconFilledColor = parts[AWCRatingPart.IconFilled]?.color ?: h.iconFilledColor, inactiveColor = parts[AWCRatingPart.IconEmpty]?.color ?: h.inactiveColor,
            stateLayerColor = parts[AWCRatingPart.StateLayer]?.backgroundColor ?: h.stateLayerColor,
            valueLabelColor = v?.color ?: h.valueLabelColor, valueLabelFontSize = v?.fontSize ?: h.valueLabelFontSize,
            valueLabelFontWeight = v?.fontWeight ?: h.valueLabelFontWeight, valueLabelLineHeight = v?.lineHeight ?: h.valueLabelLineHeight,
            valueLabelLetterSpacing = v?.letterSpacing ?: h.valueLabelLetterSpacing)
    }
}
