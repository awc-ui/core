package dev.awc.nativeui.slider

import kotlin.math.abs
import kotlin.math.min
import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.max

// md-slider.css as a geometry + colour model: every box the Web component paints (host, track and its clip, the
// inactive / active / second-inactive segments with their inside corners, stops, thumbs and knobs, value
// indicators, the inset icon), in host-local px, resolved the way Blink lays them out (calc() in float, absolute
// offsets and sizes as LayoutUnits = 1/64 px truncated toward zero, text widths ceiled to 1/64). The Compose and
// SwiftUI views draw exactly these boxes; the paint harness compares them with the Chrome capture.

/** The md-sys tokens md-slider reads (CSS colour strings; px). */
data class SliderTheme(
    val primary: String, val onPrimary: String, val secondary: String,
    val secondaryContainer: String, val onSecondaryContainer: String,
    val inverseSurface: String, val inverseOnSurface: String, val surface: String, val onSurface: String,
    /** --md-sys-density-scale inherited from the page (0 … -4) and the spacing rung that came with it. */
    val densityScale: Double = 0.0, val spacingInsetMd: Double = 12.0, val spacingInsetLg: Double = 16.0,
    val disabledContentOpacity: Double = 0.38, val disabledContainerOpacity: Double = 0.12,
    val labelFontFamily: String = "Roboto", val labelLineHeight: Double = 16.0, val labelLetterSpacing: Double = 0.5,
    val durationShort2Ms: Double = 100.0, val easingStandard: (Double) -> Double = srCubicBezier(0.2, 0.0, 0.0, 1.0),
    val springSpatialFastMs: Double = 350.0, val springSpatialFast: (Double) -> Double = srCubicBezier(0.42, 1.67, 0.21, 0.90),
    val springEffectsDefaultMs: Double = 200.0, val springEffectsDefault: (Double) -> Double = srCubicBezier(0.34, 0.80, 0.34, 1.00),
)

/** The public `--md-slider-*` custom properties (null = not set on the host). */
data class SliderHooks(
    val activeColor: String? = null, val inactiveColor: String? = null,
    val tickActiveColor: String? = null, val tickFilledColor: String? = null, val tickInactiveColor: String? = null,
    val thumbColor: String? = null, val thumbWidth: Double? = null, val thumbHeight: Double? = null,
    val trackHeight: Double? = null, val trackShape: Double? = null, val trackLength: Double? = null, val minTrackLength: Double? = null,
    val valueBg: String? = null, val valueColor: String? = null, val valueShape: Double? = null,
    val valueFontFamily: String? = null, val valueFontSize: Double? = null, val valueFontWeight: Double? = null, val valueLineHeight: Double? = null,
    val valuePaddingInline: Double? = null, val valuePaddingBlock: Double? = null,
    val insetIconColor: String? = null, val insetIconActiveColor: String? = null, val valueIndicatorReserve: Double? = null,
)

data class SliderRect(val x: Double, val y: Double, val width: Double, val height: Double) {
    fun offset(dx: Double, dy: Double) = SliderRect(x + dx, y + dy, width, height)
}

/** Physical corner radii (top-left, top-right, bottom-right, bottom-left). */
data class SliderRadii(val tl: Double, val tr: Double, val br: Double, val bl: Double)

data class SliderSegmentPaint(val kind: String, val rect: SliderRect, val radii: SliderRadii, val color: SrRgba)
data class SliderTickPaint(val kind: String, val rect: SliderRect, val color: SrRgba, val opacity: Double)
data class SliderThumbPaint(
    val thumb: String, val box: SliderRect, val knob: SliderRect, val knobColor: SrRgba,
    /** Keyboard focus: a 3 px outline in `secondary`, 2 px outside the (capsule) knob. */
    val focusRing: Boolean, val pressing: Boolean,
)
data class SliderIndicatorPaint(
    val thumb: String, val rect: SliderRect, val text: String, val background: SrRgba, val color: SrRgba,
    /** 9999 = capsule (the renderer clamps radii like CSS). */
    val radius: Double, val fontFamily: String, val fontSize: Double, val fontWeight: Double, val lineHeight: Double,
    val letterSpacing: Double, val paddingInline: Double, val paddingBlock: Double,
)
data class SliderInsetPaint(val rect: SliderRect, val color: SrRgba, val size: Double, val onActive: Boolean)

data class SliderPaint(
    val width: Double, val height: Double,
    val paddingTop: Double, val paddingLeft: Double, val paddingRight: Double,
    val opacity: Double,
    /** The track box; it clips the segments, stops and inset icon to a rounded rect of `trackRadius`. */
    val track: SliderRect, val trackRadius: Double,
    val segments: List<SliderSegmentPaint>,
    val ticks: List<SliderTickPaint>,
    val inset: SliderInsetPaint?,
    val thumbs: List<SliderThumbPaint>,
    val indicators: List<SliderIndicatorPaint>,
    val focusRingColor: SrRgba,
    /** The rail: the pointer surface (range / vertical) and the box the native input spans (single horizontal). */
    val rail: SliderRect,
)

/** Blink LayoutUnit(float): 1/64 px, truncated toward zero. */
fun sliderLU(x: Double): Double { val v = (x.toFloat() * 64f).toDouble(); return (if (v >= 0) floor(v) else ceil(v)) / 64 }
private fun luCeil(x: Double): Double = ceil(x.toFloat().toDouble() * 64) / 64
/** calc(pct% + px) against `basis`, evaluated in float like Blink's CalculationValue. */
private fun calcPx(pct: Double, px: Double, basis: Double): Double = (px.toFloat() + pct.toFloat() / 100f * basis.toFloat()).toDouble()
private fun pos(pct: Double, px: Double, basis: Double) = sliderLU(calcPx(pct, px, basis))
private fun size0(pct: Double, px: Double, basis: Double) = sliderLU(max(0.0, calcPx(pct, px, basis)))

/** color-mix(in srgb, a p, b) with premultiplied alpha. */
fun sliderColorMix(a: SrRgba, p: Double, b: SrRgba): SrRgba {
    val alpha = a.a * p + b.a * (1 - p)
    if (alpha <= 0) return SrRgba(0.0, 0.0, 0.0, 0.0)
    fun ch(x: Double, y: Double) = (x * a.a * p + y * b.a * (1 - p)) / alpha
    return SrRgba(ch(a.r, b.r), ch(a.g, b.g), ch(a.b, b.b), alpha)
}

/** tokens.css: the spacing a local `density` rung re-declares on the host. */
private fun spacingForRung(d: Int): Pair<Double, Double> = when (d) { -2, -3 -> 8.0 to 12.0; -4 -> 8.0 to 8.0; else -> 12.0 to 16.0 }

object SliderLayout {
    private data class SizeTokens(val track: Double, val thumb: Double, val radius: Double, val inset: Double?)
    private fun tokens(size: String) = when (size) {
        "sm" -> SizeTokens(24.0, 44.0, 8.0, null)
        "md" -> SizeTokens(40.0, 52.0, 12.0, 24.0)
        "lg" -> SizeTokens(56.0, 68.0, 16.0, 24.0)
        "xl" -> SizeTokens(96.0, 108.0, 28.0, 32.0)
        else -> SizeTokens(16.0, 44.0, 8.0, null)
    }

    /**
     * @param containerWidth the inline size the host fills (a vertical slider never goes below its rail; 0 = intrinsic).
     * @param containerHeight the block size a `full-height` vertical slider fills.
     * @param densityProp the host's `density` attribute (-1 … -4 override the page; 0 / null inherit it).
     * @param motion the view's transition state: call once per frame with the frame time `now` (ms); null = settled.
     */
    fun layout(
        s: SliderInteraction, theme: SliderTheme, hooks: SliderHooks, measurer: SrTextMeasurer,
        containerWidth: Double, containerHeight: Double? = null, fullHeight: Boolean = false, densityProp: Int? = null,
        motion: SliderMotion? = null, now: Double = 0.0,
    ): SliderPaint {
        val rung = densityProp?.takeIf { it in -4..-1 }
        val d = rung?.toDouble() ?: theme.densityScale
        val (insetMd, insetLg) = if (rung != null) spacingForRung(rung) else theme.spacingInsetMd to theme.spacingInsetLg
        val tk = tokens(s.size)
        val thick = hooks.trackHeight ?: max(8.0, tk.track + d * 4)
        val trackRadius = hooks.trackShape ?: tk.radius
        val thumbBlock = hooks.thumbHeight ?: max(24.0, tk.thumb + d * 4)
        val thumbInline = hooks.thumbWidth ?: 4.0
        val gap = 6.0; val centerGap = 4.0; val inside = 2.0
        val tickSize = max(4.0, (thick.toFloat() * 0.12f).toDouble())
        val tickPad = 4 + tickSize / 2
        val insetSize = when (s.size) { "md", "lg" -> max(18.0, 24 + d); "xl" -> 32.0; else -> 0.0 }
        val vertical = s.vertical; val rtl = s.rtl
        val bubble = s.showBubble

        // ── colours ──
        val c = { css: String -> srParseColor(css) }
        val onSurface = c(theme.onSurface)
        val inactiveBase = c(hooks.inactiveColor ?: theme.secondaryContainer)
        val disabledFill = sliderColorMix(onSurface, theme.disabledContentOpacity, SrRgba(0.0, 0.0, 0.0, 0.0))
        val inactive = if (s.disabled) sliderColorMix(onSurface, theme.disabledContainerOpacity, c(theme.surface)) else inactiveBase
        val active = if (s.disabled) disabledFill else c(hooks.activeColor ?: theme.primary)
        val knob = if (s.disabled) disabledFill else c(hooks.thumbColor ?: theme.primary)
        val tickFilledCss = hooks.tickFilledColor ?: theme.onPrimary
        val tickInactiveCss = hooks.tickInactiveColor ?: theme.onSecondaryContainer

        // ── host box ──
        val reserve = if (!bubble) 0.0 else hooks.valueIndicatorReserve ?: if (vertical) max(28.0, 48 + d * 4) + 4 else max(24.0, 44 + d * 4) + 4
        val padTop = if (!vertical) reserve else 0.0
        val padInlineEnd = if (vertical) reserve else 0.0
        val padLeft = if (rtl) padInlineEnd else 0.0
        val padRight = if (rtl) 0.0 else padInlineEnd
        val railW: Double; val railH: Double; val hostW: Double; val hostH: Double; val railX: Double; val railY: Double
        if (!vertical) {
            hostW = containerWidth
            railW = hostW - padLeft - padRight; railH = thumbBlock
            hostH = padTop + thumbBlock
            railX = padLeft; railY = padTop
        } else {
            railW = max(thick, thumbBlock)
            val length = hooks.trackLength ?: 200.0
            // The host fills the inline size it is given, never narrower than the rail (+ indicator reserve);
            // pass 0 for its intrinsic (max-content) width, as in a flex row.
            hostW = max(containerWidth, railW + padLeft + padRight)
            hostH = if (fullHeight) max(hooks.minTrackLength ?: 88.0, containerHeight ?: length) else length
            railH = hostH
            val cw = hostW - padLeft - padRight
            railX = padLeft + sliderLU((cw - railW) / 2); railY = 0.0
        }

        // ── track (rail-local), then everything inside it is track-local until offset ──
        val track = if (!vertical) SliderRect(0.0, sliderLU(railH * 0.5) - thick / 2, railW, thick)
                    else SliderRect(if (rtl) railW - sliderLU(railW * 0.5) - thick / 2 else sliderLU(railW * 0.5) - thick / 2, 0.0, thick, railH)
        val L = if (vertical) track.height else track.width   // the inline (horizontal) or block (vertical) track length

        /** A segment along the track: `start` from the inline start (horizontal) or the bottom (vertical), `len` long. */
        fun seg(kind: String, start: Double, len: Double, startCorners: Boolean, endCorners: Boolean, color: SrRgba): SliderSegmentPaint {
            val sr = if (startCorners) inside else 0.0; val er = if (endCorners) inside else 0.0
            return if (!vertical) {
                // Over-constrained (start offset past the end): the box keeps its start inset, width 0 (CSS 2.1 §10.3.7).
                val x = if (rtl) L - start - len else start
                // inline-start corners: left in LTR, right in RTL.
                val radii = if (!rtl) SliderRadii(sr, er, er, sr) else SliderRadii(er, sr, sr, er)
                SliderSegmentPaint(kind, SliderRect(x, 0.0, len, thick), radii, color)
            } else {
                // Block axis runs bottom-up here: "start" = bottom side, "end" = top side.
                SliderSegmentPaint(kind, SliderRect(0.0, L - start - len, thick, len), SliderRadii(er, er, sr, sr), color)
            }
        }
        val segments = mutableListOf<SliderSegmentPaint>()
        // The active fill of a stepped slider springs to each stop (inset start + size), 350 ms spatial-fast spring.
        fun spring(key: String, raw: Double): Double =
            sliderLU(if (motion != null && s.stops) motion.animate("active-$key", raw, now, theme.springSpatialFastMs, theme.springSpatialFast)
                         // The spring overshoots; a size never goes below 0 (an inset start may).
                         .let { if (key == "len") max(0.0, it) else it } else raw)
        val vp = s.valuePct
        when {
            s.range -> {
                val sp = s.startPct; val ep = s.endPct
                segments += seg("inactive", 0.0, size0(sp, -gap, L), false, true, inactive)
                segments += seg("active", spring("start", calcPx(sp, gap, L)), spring("len", max(0.0, calcPx(ep - sp, -2 * gap, L))), true, true, active)
                val after = pos(ep, gap, L)
                segments += seg("after", after, max(0.0, L - after), true, false, inactiveBase)
            }
            s.isCentered -> {
                val below = vp <= s.centerPct
                val sg = if (below) gap else centerGap; val eg = if (below) centerGap else gap
                val a0 = s.activeStartPct; val aw = s.activeWidthPct
                segments += seg("inactive", 0.0, size0(a0, -sg, L), false, true, inactive)
                segments += seg("active", spring("start", calcPx(a0, sg, L)), spring("len", max(0.0, calcPx(aw, -sg - eg, L))), true, true, active)
                val after = pos(a0 + aw, eg, L)
                segments += seg("after", after, max(0.0, L - after), true, false, inactiveBase)
            }
            !vertical -> {
                segments += seg("active", 0.0, spring("len", max(0.0, calcPx(vp, -gap, L))), false, true, active)
                val ia = pos(vp, gap, L)
                segments += seg("inactive", ia, max(0.0, L - ia), true, false, inactive)
            }
            else -> {
                segments += seg("active", 0.0, spring("len", max(0.0, calcPx(vp, -gap, L))), false, true, active)
                // The inactive part is sized from the top: block-size max(0, 100% - value - gap).
                val len = size0(100 - vp, -gap, L)
                segments += seg("inactive", L - len, len, true, false, inactive)
            }
        }
        // The Web paints the inactive segment first, then the active one, then the ::after segment.
        segments.sortBy { listOf("inactive", "active", "after").indexOf(it.kind) }

        // ── stops ──
        val ticks = mutableListOf<SliderTickPaint>()
        s.ticks()?.let { kinds ->
            val n = kinds.size
            val tickLU = sliderLU(tickSize); val half = sliderLU(-0.5 * tickSize)
            for ((i, kind) in kinds.withIndex()) {
                val frac = i.toDouble() / (n - 1)
                val p = sliderLU(tickPad + (L - 2 * tickPad) * frac)
                // Negative logical margins (-size/2) pull the dot back over its offset point.
                val rect = if (!vertical) {
                    SliderRect(if (rtl) L - p - half - tickLU else p + half, sliderLU(thick * 0.5) + half, tickLU, tickLU)
                } else {
                    val x = if (rtl) thick - sliderLU(thick * 0.5) - tickLU - half else sliderLU(thick * 0.5) + half
                    SliderRect(x, L - p - tickLU - half, tickLU, tickLU)
                }
                var (col, op) = when (kind) {
                    "active" -> c(hooks.tickActiveColor ?: theme.primary) to 0.0
                    "filled" -> c(tickFilledCss) to 1.0
                    else -> c(tickInactiveCss) to 1.0
                }
                if (motion != null) {
                    // Stop dots fade (opacity) and recolour (background) with the 200 ms effects spring.
                    val fx = { k: String, v: Double -> motion.animate("tick$i-$k", v, now, theme.springEffectsDefaultMs, theme.springEffectsDefault) }
                    op = fx("o", op)
                    // Premultiplied colour interpolation, as CSS interpolates <color>.
                    val a = fx("a", col.a)
                    col = if (a <= 0) SrRgba(0.0, 0.0, 0.0, 0.0) else SrRgba(fx("r", col.r * col.a) / a, fx("g", col.g * col.a) / a, fx("b", col.b * col.a) / a, a)
                }
                ticks += SliderTickPaint(kind, rect, col, op)
            }
        }

        // ── inset icon ──
        val inset = if (!s.insetArea) null else {
            val on = s.insetOnActive
            val col = c(if (on) hooks.insetIconActiveColor ?: tickFilledCss else hooks.insetIconColor ?: tickInactiveCss)
            val r = if (!vertical) SliderRect(if (rtl) L - 8 - insetSize else 8.0, sliderLU(thick * 0.5) - insetSize / 2, insetSize, insetSize)
                    else SliderRect(if (rtl) thick - sliderLU(thick * 0.5) - insetSize + insetSize / 2 else sliderLU(thick * 0.5) - insetSize / 2,
                                    L - 8 - insetSize, insetSize, insetSize)
            SliderInsetPaint(r, col, insetSize, on)
        }

        // ── thumbs, knobs, indicators (rail-local) ──
        val fontSize = hooks.valueFontSize ?: 12.0
        val fontWeight = hooks.valueFontWeight ?: 500.0
        val lineHeight = hooks.valueLineHeight ?: theme.labelLineHeight
        val family = hooks.valueFontFamily ?: theme.labelFontFamily
        val padBlock = hooks.valuePaddingBlock ?: max(4.0, insetMd + d * 2)
        val padInline = hooks.valuePaddingInline ?: max(8.0, insetLg + d * 2)
        val minW = max(28.0, 48 + d * 4); val minH = max(24.0, 44 + d * 4)
        val indBg = c(hooks.valueBg ?: theme.inverseSurface); val indFg = c(hooks.valueColor ?: theme.inverseOnSurface)
        val thumbs = mutableListOf<SliderThumbPaint>(); val indicators = mutableListOf<SliderIndicatorPaint>()
        val list = if (s.range) listOf("start" to s.startPct, "end" to s.endPct) else listOf("single" to vp)
        val texts = s.indicatorTexts
        for ((k, pair) in list.withIndex()) {
            val (which, pct) = pair
            val box = if (!vertical) {
                val left = sliderLU(railW.toFloat().toDouble() * pct.toFloat() / 100)
                val ml = -0.5 * thumbInline
                val x = if (rtl) railW - left - ml - thumbInline else left + ml
                SliderRect(x, sliderLU(railH * 0.5) - thumbBlock / 2, thumbInline, thumbBlock)
            } else {
                val half = sliderLU(railW * 0.5); val ml = -0.5 * thumbBlock
                val x = if (rtl) railW - half - ml - thumbBlock else half + ml
                val bottom = pos(pct, -thumbInline / 2, railH)
                SliderRect(x, railH - bottom - thumbInline, thumbBlock, thumbInline)
            }
            // The pressing class follows pressingThumb alone; the knob morph is off while disabled (md-slider.css).
            val pressingClass = s.pressingThumb == which; val pressing = pressingClass && !s.disabled
            // The press morph: 2 px wide, 1.05 × tall (short2 / standard easing both ways).
            var kw = if (!pressing) box.width else if (!vertical) 2.0 else thumbBlock * 1.05
            var kh = if (!pressing) box.height else if (!vertical) thumbBlock * 1.05 else 2.0
            if (motion != null) {
                kw = motion.animate("knob-$which-w", kw, now, theme.durationShort2Ms, theme.easingStandard)
                kh = motion.animate("knob-$which-h", kh, now, theme.durationShort2Ms, theme.easingStandard)
            }
            kw = sliderLU(kw); kh = sliderLU(kh)
            // Centred by the thumb's flex row: the main-axis offset runs from the inline start (the right edge in RTL).
            val offX = sliderLU((box.width - kw) / 2)
            val knobRect = SliderRect(if (rtl) box.x + box.width - offX - kw else box.x + offX, box.y + sliderLU((box.height - kh) / 2), kw, kh)
            thumbs += SliderThumbPaint(which, box, knobRect, knob, s.keyFocusedThumb == which, pressingClass)
            if (bubble) {
                val text = texts[k]
                val tw = luCeil(measurer.width(text, fontSize, fontWeight) + theme.labelLetterSpacing * text.length)
                val w = max(minW, tw + 2 * padInline); val h = max(minH, lineHeight + 2 * padBlock)
                val r = if (!vertical) SliderRect(box.x + sliderLU(box.width * 0.5) - w / 2, box.y - 4 - h, w, h)
                        else SliderRect(if (rtl) box.x - 4 - w else box.x + box.width + 4,
                                        box.y + box.height - sliderLU(box.height * 0.5) - h + h / 2, w, h)
                indicators += SliderIndicatorPaint(which, r, text, indBg, indFg, hooks.valueShape ?: 9999.0, family, fontSize, fontWeight,
                    lineHeight, theme.labelLetterSpacing, padInline, padBlock)
            }
        }

        // ── to host coordinates ──
        val tx = railX + track.x; val ty = railY + track.y
        return SliderPaint(
            width = hostW, height = hostH, paddingTop = padTop, paddingLeft = padLeft, paddingRight = padRight,
            opacity = if (s.disabled) theme.disabledContentOpacity else 1.0,
            track = track.offset(railX, railY), trackRadius = trackRadius,
            segments = segments.map { it.copy(rect = it.rect.offset(tx, ty)) },
            ticks = ticks.map { it.copy(rect = it.rect.offset(tx, ty)) },
            inset = inset?.let { it.copy(rect = it.rect.offset(tx, ty)) },
            thumbs = thumbs.map { it.copy(box = it.box.offset(railX, railY), knob = it.knob.offset(railX, railY)) },
            indicators = indicators.map { it.copy(rect = it.rect.offset(railX, railY)) },
            focusRingColor = c(theme.secondary),
            rail = SliderRect(railX, railY, railW, railH),
        )
    }
}

/**
 * CSS Transitions for the slider's transitioned properties, keyed by property: a change of the target starts a
 * transition from the current (possibly mid-flight) value; returning to the start of the running transition
 * reverses it with the shortened duration (CSS Transitions §3, reversing shortening factor); reduced motion
 * applies every value at once (the stylesheet's `prefers-reduced-motion` block).
 */
class SliderMotion(var reducedMotion: Boolean = false) {
    private class Tr(val from: Double, val to: Double, val start: Double, val dur: Double, val ease: (Double) -> Double,
                     val reversingStart: Double, val shortening: Double)
    private val running = HashMap<String, Tr>()
    private val target = HashMap<String, Double>()
    private fun eased(t: Tr, now: Double) = if (t.dur <= 0) 1.0 else t.ease(max(0.0, min(1.0, (now - t.start) / t.dur)))
    private fun sample(t: Tr, now: Double) = t.from + (t.to - t.from) * eased(t, now)

    fun animate(key: String, value: Double, now: Double, durationMs: Double, ease: (Double) -> Double): Double {
        val prev = target.put(key, value)
        running[key]?.let { if (now >= it.start + it.dur) running.remove(key) }
        if (reducedMotion || durationMs <= 0 || prev == null) { running.remove(key); return value }
        if (value != prev) {
            val r = running[key]
            val current = r?.let { sample(it, now) } ?: prev
            when {
                current == value -> running.remove(key)
                r != null && value == r.reversingStart -> {
                    val f = min(1.0, abs(eased(r, now) * r.shortening + 1 - r.shortening))
                    running[key] = Tr(current, value, now, durationMs * f, ease, r.to, f)
                }
                else -> running[key] = Tr(current, value, now, durationMs, ease, current, 1.0)
            }
        }
        return running[key]?.let { sample(it, now) } ?: value
    }

    /** True while any transition is still running at `now` (the view keeps requesting frames). */
    fun active(now: Double) = running.values.any { now < it.start + it.dur }
    fun reset() { running.clear(); target.clear() }
}
