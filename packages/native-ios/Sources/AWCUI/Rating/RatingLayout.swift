import Foundation

// md-rating.css as a geometry + colour model (lockstep with RatingLayout.kt): the host row (items + value label),
// each item box with its glyph layers (empty / filled with the inline-start clip / state layer / press ripple),
// the hover pop, the focus ring and the value label, resolved the way Chrome lays them out.

struct AWCRatingTheme {
    var secondary: String, onSurface: String, onSurfaceVariant: String
    /// Page density (0 … -4) and the spacing rung that came with it.
    var densityScale = 0.0, gapXs = 4.0, gapMd = 12.0
    var labelFontFamily = "Roboto", labelLineHeight = 16.0
    var disabledContentOpacity = 0.38, hoverOpacity = 0.08, pressedOpacity = 0.12
    var durationShort3Ms = 150.0, easingEmphasized: (Double) -> Double = awcSRCubicBezier(0.2, 0, 0, 1)
    var ease: (Double) -> Double = awcSRCubicBezier(0.25, 0.1, 0.25, 1)
    /// --md-sys-ripple-enabled: "0" turns the press ripple off.
    var rippleEnabled = true
}

/// The public `--md-rating-*` custom properties (nil = not set).
struct AWCRatingHooks {
    var itemSize: Double? = nil, itemGap: Double? = nil, activeColor: String? = nil, inactiveColor: String? = nil
    var focusRingColor: String? = nil, focusRingWidth: Double? = nil, focusRingOffset: Double? = nil
    var stateLayerColor: String? = nil, valueLabelColor: String? = nil
    /// --md-rating-value-label-font is a `font` shorthand: only its family and line-height survive (size / weight are re-set).
    var valueLabelFontFamily: String? = nil, valueLabelLineHeight: Double? = nil
    var popScale: Double? = nil, durationMs: Double? = nil
    /// ::part(value-label) only (no hook sets them): font size / weight and letter spacing of the value label.
    var valueLabelFontSize: Double? = nil, valueLabelFontWeight: Double? = nil, valueLabelLetterSpacing: Double? = nil
    /// ::part(icon-filled) colour: the filled glyph only (the host's colour stays the active colour).
    var iconFilledColor: String? = nil
    /// ::part(item) width / height: the item box (the glyph keeps --_size, centred in it).
    var itemBox: Double? = nil
}

/// A press ripple: started at `start` (ms) at (x %, y %) of the item, 420 ms emphasized, circle 0 → 85 %, opacity .22 → 0.
struct AWCRatingRipple { var item: Int, start: Double, xPct: Double, yPct: Double }

struct AWCRatingItemPaint {
    var index: Int, rect: AWCSliderRect, kind: String
    /// The filled glyph's clip: `clipPct` % cut from the inline-end side (the right in LTR, the left in RTL).
    var fill: Double, clipPct: Double, clipFromLeft: Bool
    var scale: Double, stateOpacity: Double
    /// The state layer and ripple are display:none unless the rating is interactive.
    var stateVisible: Bool
    /// Active ripple: circle radius as a % of the item's reference radius (√(w²+h²)/√2), its centre and opacity.
    var rippleRadiusPct: Double?, rippleXPct: Double, rippleYPct: Double, rippleOpacity: Double
}

struct AWCRatingPaint {
    var width: Double, height: Double, opacity: Double
    var items: AWCSliderRect, itemList: [AWCRatingItemPaint]
    var icon: String, emptyIcon: String
    /// Glyph axes: the empty layer is FILL 0 / wght 500 with outline-empty, else FILL 1 / wght 400; the filled layer FILL 1 / wght 500.
    var emptyFill: Int, emptyWeight: Int, glyphSize: Double
    var activeColor: AWCSRRGBA, inactiveColor: AWCSRRGBA, stateLayerColor: AWCSRRGBA
    /// The filled glyph's colour when ::part(icon-filled) sets one (nil: the active colour).
    var iconColor: AWCSRRGBA? = nil
    var focusRing: Bool, focusRingColor: AWCSRRGBA, focusRingWidth: Double, focusRingOffset: Double
    var label: AWCSliderRect?, labelText: String?, labelColor: AWCSRRGBA, labelFontFamily: String
    var labelFontSize: Double, labelFontWeight: Double, labelLineHeight: Double
    var labelLetterSpacing = 0.0
}

private func luCeil(_ x: Double) -> Double { (Double(Float(x)) * 64).rounded(.up) / 64 }
/// tokens.css: the gaps a local `density` rung re-declares on the host (gap-xs, gap-md).
private func gapsForRung(_ d: Int) -> (Double, Double) { d == -2 || d == -3 ? (4, 8) : d == -4 ? (2, 4) : (4, 12) }

enum AWCRatingLayout {
    private static func base(_ size: String) -> Double {
        switch size { case "xs": return 16; case "sm": return 20; case "lg": return 36; case "xl": return 48; default: return 28 }
    }

    /// - hoverItem: the item under the pointer (`:hover`, -1 none); pressedItem: the item held down (`:active`).
    /// - motion: transition state (call once per frame with `now`, ms); nil = settled.
    static func layout(_ r: AWCRatingInteraction, theme: AWCRatingTheme, hooks: AWCRatingHooks,
                       measure: (String, Double, Double) -> Double = { AWCSRTextMetrics.width($0, size: $1, weight: $2) },
                       size: String = "md", icon: String = "star", emptyIcon: String = "star", outlineEmpty: Bool = true,
                       showValueLabel: Bool = false, densityProp: Int? = nil,
                       hoverItem: Int = -1, pressedItem: Int = -1, ripples: [AWCRatingRipple] = [],
                       reducedMotion: Bool = false, motion: AWCSliderMotion? = nil, now: Double = 0) -> AWCRatingPaint {
        let rung = densityProp.flatMap { (-4 ... -1).contains($0) ? $0 : nil }
        let d = rung.map(Double.init) ?? theme.densityScale
        let (gapXs, gapMd) = rung.map(gapsForRung) ?? (theme.gapXs, theme.gapMd)
        let glyph = hooks.itemSize ?? Swift.max(12, base(size) + d * 2)
        let itemSize = hooks.itemBox ?? glyph      // the item box (::part(item) width / height); the glyph keeps --_size
        let gap = hooks.itemGap ?? gapXs
        let c = { (css: String) in awcSRParseColor(css) }
        let active = c(hooks.activeColor ?? theme.secondary)
        let inactive = hooks.inactiveColor.map(c) ?? awcSliderColorMix(c(theme.onSurfaceVariant), 0.30, (0, 0, 0, 0))
        let stateColor = c(hooks.stateLayerColor ?? theme.onSurface)
        let labelColor = c(hooks.valueLabelColor ?? theme.onSurface)
        let n = r.max
        let itemsW = Double(n) * itemSize + Double(Swift.max(0, n - 1)) * gap
        // Value label: an inline grid stacking the hidden sizers (every step's label) under the visible text.
        let labelFont = hooks.valueLabelFontSize ?? 14.0, labelWeight = hooks.valueLabelFontWeight ?? 500.0, labelSpacing = hooks.valueLabelLetterSpacing ?? 0
        let labelLine = hooks.valueLabelLineHeight ?? theme.labelLineHeight
        let labelText: String? = showValueLabel ? r.label(r.displayValue) : nil
        let labelW = labelText.map { t in (r.labelVariants() + [t]).map { luCeil(measure($0, labelFont, labelWeight) + labelSpacing * Double($0.count)) }.max() ?? 0 } ?? 0
        let hostW = itemsW + (showValueLabel ? gapMd + labelW : 0)
        let hostH = Swift.max(itemSize, showValueLabel ? labelLine : 0)
        let rtl = r.rtl
        let itemsX = rtl ? hostW - itemsW : 0
        let items = AWCSliderRect(x: itemsX, y: (hostH - itemSize) / 2, width: itemsW, height: itemSize)
        let label: AWCSliderRect? = showValueLabel ? AWCSliderRect(x: rtl ? 0 : hostW - labelW, y: (hostH - labelLine) / 2, width: labelW, height: labelLine) : nil

        let interactive = r.isInteractive
        let pop = hooks.popScale ?? 1.12
        let dur = hooks.durationMs ?? theme.durationShort3Ms
        let list: [AWCRatingItemPaint] = (0..<n).map { i in
            let x = rtl ? itemsX + itemsW - Double(i + 1) * itemSize - Double(i) * gap : itemsX + Double(i) * (itemSize + gap)
            let fill = r.fill(i)
            // :hover pops the item (not when inert or under reduced motion); the state layer tints it (pressed > hover).
            // Readonly still hovers (its state layer is display:none, so the tint is computed but not drawn);
            // disabled / soft-disabled items take no pointer at all.
            let hoverable = !r.disabled && !r.softDisabled
            var scale = interactive && hoverItem == i && !reducedMotion ? pop : 1
            var state = !hoverable ? 0 : pressedItem == i ? theme.pressedOpacity : hoverItem == i ? theme.hoverOpacity : 0
            if let motion {
                scale = motion.animate("item\(i)-scale", scale, now: now, durationMs: reducedMotion ? 0 : dur, ease: theme.easingEmphasized)
                // A display:none state layer (readonly) has no transitions: its computed opacity switches at once.
                state = motion.animate("item\(i)-state", state, now: now, durationMs: reducedMotion || !interactive ? 0 : dur, ease: theme.ease)
            }
            // (Frame times are coarse: a ripple counts from half a millisecond before its start.)
            let rp = ripples.last { $0.item == i && interactive && theme.rippleEnabled && now >= $0.start - 0.5 && now < $0.start + 420 }
            let e = rp.map { theme.easingEmphasized(Swift.max(0, Swift.min(1, (now - $0.start) / 420))) }
            return AWCRatingItemPaint(index: i, rect: AWCSliderRect(x: x, y: items.y, width: itemSize, height: itemSize), kind: r.itemState(i),
                                      fill: fill, clipPct: (1 - fill) * 100, clipFromLeft: rtl, scale: scale, stateOpacity: state, stateVisible: interactive,
                                      rippleRadiusPct: e.map { 85 * $0 }, rippleXPct: rp?.xPct ?? 50, rippleYPct: rp?.yPct ?? 50,
                                      rippleOpacity: e.map { 0.22 * (1 - $0) } ?? 0)
        }
        return AWCRatingPaint(
            width: hostW, height: hostH, opacity: r.disabled || r.softDisabled ? theme.disabledContentOpacity : 1,
            items: items, itemList: list, icon: icon, emptyIcon: outlineEmpty ? icon : emptyIcon,
            emptyFill: outlineEmpty ? 0 : 1, emptyWeight: outlineEmpty ? 500 : 400, glyphSize: glyph,
            activeColor: active, inactiveColor: inactive, stateLayerColor: stateColor, iconColor: hooks.iconFilledColor.map(c),
            focusRing: r.focused && r.focusVisible, focusRingColor: c(hooks.focusRingColor ?? theme.secondary),
            focusRingWidth: hooks.focusRingWidth ?? 3, focusRingOffset: hooks.focusRingOffset ?? 2,
            label: label, labelText: labelText, labelColor: labelColor, labelFontFamily: hooks.valueLabelFontFamily ?? theme.labelFontFamily,
            labelFontSize: labelFont, labelFontWeight: labelWeight, labelLineHeight: labelLine, labelLetterSpacing: labelSpacing)
    }

    /// The ripple circle's radius in points for an item box (CSS `circle(r%)` resolves against √(w²+h²)/√2).
    static func rippleRadius(_ pct: Double, _ w: Double, _ h: Double) -> Double { pct / 100 * (w * w + h * h).squareRoot() / 2.0.squareRoot() }
}
