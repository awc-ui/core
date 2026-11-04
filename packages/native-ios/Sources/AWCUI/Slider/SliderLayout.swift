import Foundation

// md-slider.css as a geometry + colour model (lockstep with SliderLayout.kt): every box the Web component paints
// (host, track and its clip, the inactive / active / second-inactive segments with their inside corners, stops,
// thumbs and knobs, value indicators, the inset icon), in host-local points, resolved the way Blink lays them out
// (calc() in float, offsets and sizes as LayoutUnits = 1/64 px truncated toward zero, text widths ceiled to 1/64).
// The SwiftUI view draws exactly these boxes; NativeSliderRatingIntegration compares them with Chrome.

struct AWCSliderTheme {
    var primary: String, onPrimary: String, secondary: String
    var secondaryContainer: String, onSecondaryContainer: String
    var inverseSurface: String, inverseOnSurface: String, surface: String, onSurface: String
    /// --md-sys-density-scale inherited from the page (0 … -4) and the spacing rung that came with it.
    var densityScale = 0.0, spacingInsetMd = 12.0, spacingInsetLg = 16.0
    var disabledContentOpacity = 0.38, disabledContainerOpacity = 0.12
    var labelFontFamily = "Roboto", labelLineHeight = 16.0, labelLetterSpacing = 0.5
    var durationShort2Ms = 100.0, easingStandard: (Double) -> Double = awcSRCubicBezier(0.2, 0, 0, 1)
    var springSpatialFastMs = 350.0, springSpatialFast: (Double) -> Double = awcSRCubicBezier(0.42, 1.67, 0.21, 0.90)
    var springEffectsDefaultMs = 200.0, springEffectsDefault: (Double) -> Double = awcSRCubicBezier(0.34, 0.80, 0.34, 1.00)
}

/// The public `--md-slider-*` custom properties (nil = not set on the host).
struct AWCSliderHooks {
    var activeColor: String? = nil, inactiveColor: String? = nil
    var tickActiveColor: String? = nil, tickFilledColor: String? = nil, tickInactiveColor: String? = nil
    var thumbColor: String? = nil, thumbWidth: Double? = nil, thumbHeight: Double? = nil
    var trackHeight: Double? = nil, trackShape: Double? = nil, trackLength: Double? = nil, minTrackLength: Double? = nil
    var valueBg: String? = nil, valueColor: String? = nil, valueShape: Double? = nil
    var valueFontFamily: String? = nil, valueFontSize: Double? = nil, valueFontWeight: Double? = nil, valueLineHeight: Double? = nil
    var valuePaddingInline: Double? = nil, valuePaddingBlock: Double? = nil
    var insetIconColor: String? = nil, insetIconActiveColor: String? = nil, valueIndicatorReserve: Double? = nil
}

struct AWCSliderRect: Equatable, CustomStringConvertible {
    var x: Double, y: Double, width: Double, height: Double
    func offset(_ dx: Double, _ dy: Double) -> AWCSliderRect { AWCSliderRect(x: x + dx, y: y + dy, width: width, height: height) }
    var description: String { "(\(x), \(y), \(width)x\(height))" }
}
/// Physical corner radii (top-left, top-right, bottom-right, bottom-left).
struct AWCSliderRadii: Equatable { var tl: Double, tr: Double, br: Double, bl: Double }

struct AWCSliderSegmentPaint { var kind: String; var rect: AWCSliderRect; var radii: AWCSliderRadii; var color: AWCSRRGBA }
struct AWCSliderTickPaint { var kind: String; var rect: AWCSliderRect; var color: AWCSRRGBA; var opacity: Double }
struct AWCSliderThumbPaint {
    var thumb: String; var box: AWCSliderRect; var knob: AWCSliderRect; var knobColor: AWCSRRGBA
    /// Keyboard focus: a 3 px outline in `secondary`, 2 px outside the (capsule) knob.
    var focusRing: Bool; var pressing: Bool
}
struct AWCSliderIndicatorPaint {
    var thumb: String; var rect: AWCSliderRect; var text: String; var background: AWCSRRGBA; var color: AWCSRRGBA
    /// 9999 = capsule (the renderer clamps radii like CSS).
    var radius: Double; var fontFamily: String; var fontSize: Double; var fontWeight: Double; var lineHeight: Double
    var letterSpacing: Double; var paddingInline: Double; var paddingBlock: Double
}
struct AWCSliderInsetPaint { var rect: AWCSliderRect; var color: AWCSRRGBA; var size: Double; var onActive: Bool }

struct AWCSliderPaint {
    var width: Double, height: Double
    var paddingTop: Double, paddingLeft: Double, paddingRight: Double
    var opacity: Double
    /// The track box; it clips the segments, stops and inset icon to a rounded rect of `trackRadius`.
    var track: AWCSliderRect, trackRadius: Double
    var segments: [AWCSliderSegmentPaint]
    var ticks: [AWCSliderTickPaint]
    var inset: AWCSliderInsetPaint?
    var thumbs: [AWCSliderThumbPaint]
    var indicators: [AWCSliderIndicatorPaint]
    var focusRingColor: AWCSRRGBA
    /// The rail: the pointer surface (range / vertical) and the box the native input spans (single horizontal).
    var rail: AWCSliderRect
}

/// Blink LayoutUnit(float): 1/64 px, truncated toward zero.
func awcSliderLU(_ x: Double) -> Double { let v = Double(Float(x) * 64); return (v >= 0 ? v.rounded(.down) : v.rounded(.up)) / 64 }
private func luCeil(_ x: Double) -> Double { (Double(Float(x)) * 64).rounded(.up) / 64 }
/// calc(pct% + px) against `basis`, evaluated in float like Blink's CalculationValue.
private func calcPx(_ pct: Double, _ px: Double, _ basis: Double) -> Double { Double(Float(px) + Float(pct) / 100 * Float(basis)) }
private func pos(_ pct: Double, _ px: Double, _ basis: Double) -> Double { awcSliderLU(calcPx(pct, px, basis)) }
private func size0(_ pct: Double, _ px: Double, _ basis: Double) -> Double { awcSliderLU(Swift.max(0, calcPx(pct, px, basis))) }

/// color-mix(in srgb, a p, b) with premultiplied alpha.
func awcSliderColorMix(_ a: AWCSRRGBA, _ p: Double, _ b: AWCSRRGBA) -> AWCSRRGBA {
    let alpha = a.3 * p + b.3 * (1 - p)
    if alpha <= 0 { return (0, 0, 0, 0) }
    func ch(_ x: Double, _ y: Double) -> Double { (x * a.3 * p + y * b.3 * (1 - p)) / alpha }
    return (ch(a.0, b.0), ch(a.1, b.1), ch(a.2, b.2), alpha)
}

/// tokens.css: the spacing a local `density` rung re-declares on the host.
private func spacingForRung(_ d: Int) -> (Double, Double) { d == -2 || d == -3 ? (8, 12) : d == -4 ? (8, 8) : (12, 16) }

enum AWCSliderLayout {
    private static func tokens(_ size: String) -> (track: Double, thumb: Double, radius: Double) {
        switch size {
        case "sm": return (24, 44, 8)
        case "md": return (40, 52, 12)
        case "lg": return (56, 68, 16)
        case "xl": return (96, 108, 28)
        default: return (16, 44, 8)
        }
    }

    /// - containerWidth: the inline size the host fills (a vertical slider never goes below its rail; 0 = intrinsic).
    /// - containerHeight: the block size a `full-height` vertical slider fills.
    /// - densityProp: the host's `density` attribute (-1 … -4 override the page; 0 / nil inherit it).
    /// - motion: the view's transition state, called once per frame with the frame time `now` (ms); nil = settled.
    static func layout(_ s: AWCSliderInteraction, theme: AWCSliderTheme, hooks: AWCSliderHooks,
                       measure: (String, Double, Double) -> Double = { AWCSRTextMetrics.width($0, size: $1, weight: $2) },
                       containerWidth: Double, containerHeight: Double? = nil, fullHeight: Bool = false, densityProp: Int? = nil,
                       motion: AWCSliderMotion? = nil, now: Double = 0) -> AWCSliderPaint {
        let rung = densityProp.flatMap { (-4 ... -1).contains($0) ? $0 : nil }
        let d = rung.map(Double.init) ?? theme.densityScale
        let (insetMd, insetLg) = rung.map(spacingForRung) ?? (theme.spacingInsetMd, theme.spacingInsetLg)
        let tk = tokens(s.size)
        let thick = hooks.trackHeight ?? Swift.max(8, tk.track + d * 4)
        let trackRadius = hooks.trackShape ?? tk.radius
        let thumbBlock = hooks.thumbHeight ?? Swift.max(24, tk.thumb + d * 4)
        let thumbInline = hooks.thumbWidth ?? 4
        let gap = 6.0, centerGap = 4.0, inside = 2.0
        let tickSize = Swift.max(4, Double(Float(thick) * Float(0.12)))
        let tickPad = 4 + tickSize / 2
        let insetSize: Double = s.size == "md" || s.size == "lg" ? Swift.max(18, 24 + d) : s.size == "xl" ? 32 : 0
        let vertical = s.vertical, rtl = s.rtl, bubble = s.showBubble

        // ── colours ──
        let c = { (css: String) in awcSRParseColor(css) }
        let onSurface = c(theme.onSurface)
        let inactiveBase = c(hooks.inactiveColor ?? theme.secondaryContainer)
        let disabledFill = awcSliderColorMix(onSurface, theme.disabledContentOpacity, (0, 0, 0, 0))
        let inactive = s.disabled ? awcSliderColorMix(onSurface, theme.disabledContainerOpacity, c(theme.surface)) : inactiveBase
        let active = s.disabled ? disabledFill : c(hooks.activeColor ?? theme.primary)
        let knob = s.disabled ? disabledFill : c(hooks.thumbColor ?? theme.primary)
        let tickFilledCss = hooks.tickFilledColor ?? theme.onPrimary
        let tickInactiveCss = hooks.tickInactiveColor ?? theme.onSecondaryContainer

        // ── host box ──
        let reserve = !bubble ? 0 : hooks.valueIndicatorReserve ?? (vertical ? Swift.max(28, 48 + d * 4) + 4 : Swift.max(24, 44 + d * 4) + 4)
        let padTop = vertical ? 0 : reserve
        let padInlineEnd = vertical ? reserve : 0
        let padLeft = rtl ? padInlineEnd : 0, padRight = rtl ? 0 : padInlineEnd
        let railW: Double, railH: Double, hostW: Double, hostH: Double, railX: Double, railY: Double
        if !vertical {
            hostW = containerWidth
            railW = hostW - padLeft - padRight; railH = thumbBlock
            hostH = padTop + thumbBlock
            railX = padLeft; railY = padTop
        } else {
            railW = Swift.max(thick, thumbBlock)
            let length = hooks.trackLength ?? 200
            // The host fills the inline size it is given, never narrower than the rail (+ indicator reserve).
            hostW = Swift.max(containerWidth, railW + padLeft + padRight)
            hostH = fullHeight ? Swift.max(hooks.minTrackLength ?? 88, containerHeight ?? length) : length
            railH = hostH
            railX = padLeft + awcSliderLU((hostW - padLeft - padRight - railW) / 2); railY = 0
        }

        // ── track (rail-local); segments, stops and the inset icon are track-local until offset ──
        let track = !vertical ? AWCSliderRect(x: 0, y: awcSliderLU(railH * 0.5) - thick / 2, width: railW, height: thick)
            : AWCSliderRect(x: rtl ? railW - awcSliderLU(railW * 0.5) - thick / 2 : awcSliderLU(railW * 0.5) - thick / 2, y: 0, width: thick, height: railH)
        let L = vertical ? track.height : track.width

        /// A segment along the track: `start` from the inline start (horizontal) or the bottom (vertical), `len` long.
        func seg(_ kind: String, _ start: Double, _ len: Double, _ startCorners: Bool, _ endCorners: Bool, _ color: AWCSRRGBA) -> AWCSliderSegmentPaint {
            let sr = startCorners ? inside : 0, er = endCorners ? inside : 0
            if !vertical {
                // Over-constrained (start offset past the end): the box keeps its start inset, width 0 (CSS 2.1 §10.3.7).
                let x = rtl ? L - start - len : start
                let radii = !rtl ? AWCSliderRadii(tl: sr, tr: er, br: er, bl: sr) : AWCSliderRadii(tl: er, tr: sr, br: sr, bl: er)
                return AWCSliderSegmentPaint(kind: kind, rect: AWCSliderRect(x: x, y: 0, width: len, height: thick), radii: radii, color: color)
            }
            // Block axis runs bottom-up here: "start" = bottom side, "end" = top side.
            return AWCSliderSegmentPaint(kind: kind, rect: AWCSliderRect(x: 0, y: L - start - len, width: thick, height: len),
                                         radii: AWCSliderRadii(tl: er, tr: er, br: sr, bl: sr), color: color)
        }
        var segments: [AWCSliderSegmentPaint] = []
        // The active fill of a stepped slider springs to each stop (inset start + size), 350 ms spatial-fast spring.
        func spring(_ key: String, _ raw: Double) -> Double {
            guard let motion, s.stops else { return awcSliderLU(raw) }
            let v = motion.animate("active-\(key)", raw, now: now, durationMs: theme.springSpatialFastMs, ease: theme.springSpatialFast)
            // The spring overshoots; a size never goes below 0 (an inset start may).
            return awcSliderLU(key == "len" ? Swift.max(0, v) : v)
        }
        let vp = s.valuePct
        if s.range {
            let sp = s.startPct, ep = s.endPct
            segments.append(seg("inactive", 0, size0(sp, -gap, L), false, true, inactive))
            segments.append(seg("active", spring("start", calcPx(sp, gap, L)), spring("len", Swift.max(0, calcPx(ep - sp, -2 * gap, L))), true, true, active))
            let after = pos(ep, gap, L)
            segments.append(seg("after", after, Swift.max(0, L - after), true, false, inactiveBase))
        } else if s.isCentered {
            let below = vp <= s.centerPct
            let sg = below ? gap : centerGap, eg = below ? centerGap : gap
            let a0 = s.activeStartPct, aw = s.activeWidthPct
            segments.append(seg("inactive", 0, size0(a0, -sg, L), false, true, inactive))
            segments.append(seg("active", spring("start", calcPx(a0, sg, L)), spring("len", Swift.max(0, calcPx(aw, -sg - eg, L))), true, true, active))
            let after = pos(a0 + aw, eg, L)
            segments.append(seg("after", after, Swift.max(0, L - after), true, false, inactiveBase))
        } else if !vertical {
            segments.append(seg("active", 0, spring("len", Swift.max(0, calcPx(vp, -gap, L))), false, true, active))
            let ia = pos(vp, gap, L)
            segments.append(seg("inactive", ia, Swift.max(0, L - ia), true, false, inactive))
        } else {
            segments.append(seg("active", 0, spring("len", Swift.max(0, calcPx(vp, -gap, L))), false, true, active))
            // The inactive part is sized from the top: block-size max(0, 100% - value - gap).
            let len = size0(100 - vp, -gap, L)
            segments.append(seg("inactive", L - len, len, true, false, inactive))
        }
        // The Web paints the inactive segment first, then the active one, then the ::after segment.
        let order = ["inactive", "active", "after"]
        segments.sort { order.firstIndex(of: $0.kind)! < order.firstIndex(of: $1.kind)! }

        // ── stops ──
        var ticks: [AWCSliderTickPaint] = []
        if let kinds = s.ticks() {
            let n = kinds.count
            let tickLU = awcSliderLU(tickSize), half = awcSliderLU(-0.5 * tickSize)
            for (i, kind) in kinds.enumerated() {
                let frac = Double(i) / Double(n - 1)
                let p = awcSliderLU(tickPad + (L - 2 * tickPad) * frac)
                // Negative logical margins (-size/2) pull the dot back over its offset point.
                let rect = !vertical
                    ? AWCSliderRect(x: rtl ? L - p - half - tickLU : p + half, y: awcSliderLU(thick * 0.5) + half, width: tickLU, height: tickLU)
                    : AWCSliderRect(x: rtl ? thick - awcSliderLU(thick * 0.5) - tickLU - half : awcSliderLU(thick * 0.5) + half,
                                    y: L - p - tickLU - half, width: tickLU, height: tickLU)
                var col: AWCSRRGBA, op: Double
                switch kind {
                case "active": col = c(hooks.tickActiveColor ?? theme.primary); op = 0
                case "filled": col = c(tickFilledCss); op = 1
                default: col = c(tickInactiveCss); op = 1
                }
                if let motion {
                    // Stop dots fade (opacity) and recolour (background) with the 200 ms effects spring.
                    let fx = { (k: String, v: Double) in motion.animate("tick\(i)-\(k)", v, now: now, durationMs: theme.springEffectsDefaultMs, ease: theme.springEffectsDefault) }
                    op = fx("o", op)
                    // Premultiplied colour interpolation, as CSS interpolates <color>.
                    let a = fx("a", col.3)
                    col = a <= 0 ? (0, 0, 0, 0) : (fx("r", col.0 * col.3) / a, fx("g", col.1 * col.3) / a, fx("b", col.2 * col.3) / a, a)
                }
                ticks.append(AWCSliderTickPaint(kind: kind, rect: rect, color: col, opacity: op))
            }
        }

        // ── inset icon ──
        var inset: AWCSliderInsetPaint? = nil
        if s.insetArea {
            let on = s.insetOnActive
            let col = c(on ? hooks.insetIconActiveColor ?? tickFilledCss : hooks.insetIconColor ?? tickInactiveCss)
            let r = !vertical
                ? AWCSliderRect(x: rtl ? L - 8 - insetSize : 8, y: awcSliderLU(thick * 0.5) - insetSize / 2, width: insetSize, height: insetSize)
                : AWCSliderRect(x: rtl ? thick - awcSliderLU(thick * 0.5) - insetSize + insetSize / 2 : awcSliderLU(thick * 0.5) - insetSize / 2,
                                y: L - 8 - insetSize, width: insetSize, height: insetSize)
            inset = AWCSliderInsetPaint(rect: r, color: col, size: insetSize, onActive: on)
        }

        // ── thumbs, knobs, indicators (rail-local) ──
        let fontSize = hooks.valueFontSize ?? 12
        let fontWeight = hooks.valueFontWeight ?? 500
        let lineHeight = hooks.valueLineHeight ?? theme.labelLineHeight
        let family = hooks.valueFontFamily ?? theme.labelFontFamily
        let padBlock = hooks.valuePaddingBlock ?? Swift.max(4, insetMd + d * 2)
        let padInline = hooks.valuePaddingInline ?? Swift.max(8, insetLg + d * 2)
        let minW = Swift.max(28, 48 + d * 4), minH = Swift.max(24, 44 + d * 4)
        let indBg = c(hooks.valueBg ?? theme.inverseSurface), indFg = c(hooks.valueColor ?? theme.inverseOnSurface)
        var thumbs: [AWCSliderThumbPaint] = [], indicators: [AWCSliderIndicatorPaint] = []
        let list: [(String, Double)] = s.range ? [("start", s.startPct), ("end", s.endPct)] : [("single", vp)]
        let texts = s.indicatorTexts
        for (k, (which, pct)) in list.enumerated() {
            let box: AWCSliderRect
            if !vertical {
                let left = awcSliderLU(Double(Float(railW) * Float(pct) / 100))
                let ml = -0.5 * thumbInline
                box = AWCSliderRect(x: rtl ? railW - left - ml - thumbInline : left + ml, y: awcSliderLU(railH * 0.5) - thumbBlock / 2, width: thumbInline, height: thumbBlock)
            } else {
                let half = awcSliderLU(railW * 0.5), ml = -0.5 * thumbBlock
                let bottom = pos(pct, -thumbInline / 2, railH)
                box = AWCSliderRect(x: rtl ? railW - half - ml - thumbBlock : half + ml, y: railH - bottom - thumbInline, width: thumbBlock, height: thumbInline)
            }
            // The pressing class follows pressingThumb alone; the knob morph is off while disabled (md-slider.css).
            let pressingClass = s.pressingThumb == which, pressing = pressingClass && !s.disabled
            // The press morph: 2 px wide, 1.05 × tall (short2 / standard easing both ways).
            var kw = !pressing ? box.width : !vertical ? 2 : thumbBlock * 1.05
            var kh = !pressing ? box.height : !vertical ? thumbBlock * 1.05 : 2
            if let motion {
                kw = motion.animate("knob-\(which)-w", kw, now: now, durationMs: theme.durationShort2Ms, ease: theme.easingStandard)
                kh = motion.animate("knob-\(which)-h", kh, now: now, durationMs: theme.durationShort2Ms, ease: theme.easingStandard)
            }
            kw = awcSliderLU(kw); kh = awcSliderLU(kh)
            // Centred by the thumb's flex row: the main-axis offset runs from the inline start (the right edge in RTL).
            let offX = awcSliderLU((box.width - kw) / 2)
            let knobRect = AWCSliderRect(x: rtl ? box.x + box.width - offX - kw : box.x + offX, y: box.y + awcSliderLU((box.height - kh) / 2), width: kw, height: kh)
            thumbs.append(AWCSliderThumbPaint(thumb: which, box: box, knob: knobRect, knobColor: knob, focusRing: s.keyFocusedThumb == which, pressing: pressingClass))
            if bubble {
                let text = texts[k]
                let tw = luCeil(measure(text, fontSize, fontWeight) + theme.labelLetterSpacing * Double(text.count))
                let w = Swift.max(minW, tw + 2 * padInline), h = Swift.max(minH, lineHeight + 2 * padBlock)
                let r = !vertical
                    ? AWCSliderRect(x: box.x + awcSliderLU(box.width * 0.5) - w / 2, y: box.y - 4 - h, width: w, height: h)
                    : AWCSliderRect(x: rtl ? box.x - 4 - w : box.x + box.width + 4, y: box.y + box.height - awcSliderLU(box.height * 0.5) - h + h / 2, width: w, height: h)
                indicators.append(AWCSliderIndicatorPaint(thumb: which, rect: r, text: text, background: indBg, color: indFg, radius: hooks.valueShape ?? 9999,
                                                          fontFamily: family, fontSize: fontSize, fontWeight: fontWeight, lineHeight: lineHeight,
                                                          letterSpacing: theme.labelLetterSpacing, paddingInline: padInline, paddingBlock: padBlock))
            }
        }

        // ── to host coordinates ──
        let tx = railX + track.x, ty = railY + track.y
        return AWCSliderPaint(
            width: hostW, height: hostH, paddingTop: padTop, paddingLeft: padLeft, paddingRight: padRight,
            opacity: s.disabled ? theme.disabledContentOpacity : 1,
            track: track.offset(railX, railY), trackRadius: trackRadius,
            segments: segments.map { var v = $0; v.rect = v.rect.offset(tx, ty); return v },
            ticks: ticks.map { var v = $0; v.rect = v.rect.offset(tx, ty); return v },
            inset: inset.map { var v = $0; v.rect = v.rect.offset(tx, ty); return v },
            thumbs: thumbs.map { var v = $0; v.box = v.box.offset(railX, railY); v.knob = v.knob.offset(railX, railY); return v },
            indicators: indicators.map { var v = $0; v.rect = v.rect.offset(railX, railY); return v },
            focusRingColor: c(theme.secondary),
            rail: AWCSliderRect(x: railX, y: railY, width: railW, height: railH))
    }
}

/// CSS Transitions for the slider's transitioned properties, keyed by property: a change of the target starts a
/// transition from the current (possibly mid-flight) value; returning to the start of the running transition
/// reverses it with the shortened duration (CSS Transitions §3, reversing shortening factor); reduced motion
/// applies every value at once (the stylesheet's `prefers-reduced-motion` block).
final class AWCSliderMotion {
    private struct Tr { var from: Double, to: Double, start: Double, dur: Double, ease: (Double) -> Double, reversingStart: Double, shortening: Double }
    var reducedMotion: Bool
    private var running: [String: Tr] = [:]
    private var target: [String: Double] = [:]
    init(reducedMotion: Bool = false) { self.reducedMotion = reducedMotion }
    private func eased(_ t: Tr, _ now: Double) -> Double { t.dur <= 0 ? 1 : t.ease(Swift.max(0, Swift.min(1, (now - t.start) / t.dur))) }
    private func sample(_ t: Tr, _ now: Double) -> Double { t.from + (t.to - t.from) * eased(t, now) }

    func animate(_ key: String, _ value: Double, now: Double, durationMs: Double, ease: @escaping (Double) -> Double) -> Double {
        let prev = target.updateValue(value, forKey: key)
        if let r = running[key], now >= r.start + r.dur { running[key] = nil }
        guard !reducedMotion, durationMs > 0, let prev else { running[key] = nil; return value }
        if value != prev {
            let r = running[key]
            let current = r.map { sample($0, now) } ?? prev
            if current == value { running[key] = nil }
            else if let r, value == r.reversingStart {
                let f = Swift.min(1, abs(eased(r, now) * r.shortening + 1 - r.shortening))
                running[key] = Tr(from: current, to: value, start: now, dur: durationMs * f, ease: ease, reversingStart: r.to, shortening: f)
            } else {
                running[key] = Tr(from: current, to: value, start: now, dur: durationMs, ease: ease, reversingStart: current, shortening: 1)
            }
        }
        return running[key].map { sample($0, now) } ?? value
    }

    /// True while any transition is still running at `now` (the view keeps requesting frames).
    func active(_ now: Double) -> Bool { running.values.contains { now < $0.start + $0.dur } }
    func reset() { running.removeAll(); target.removeAll() }
}
