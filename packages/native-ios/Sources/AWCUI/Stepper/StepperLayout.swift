import Foundation
#if canImport(CoreText)
import CoreText
#endif

// md-stepper / md-step geometry, paint and motion (md-stepper.css, md-step.css), as Chrome lays them out: LayoutUnit
// (1/64 px) snapping, the panel-mode grid, the vertical rail, the mobile bar, density, hooks and RTL. Pure: the
// SwiftUI view draws it and the parity tests compare it with Chrome's computed boxes and styles.

public struct AWCStepperRect: Equatable, Sendable {
    public var x = 0.0, y = 0.0, width = 0.0, height = 0.0
    public init(x: Double = 0, y: Double = 0, width: Double = 0, height: Double = 0) { self.x = x; self.y = y; self.width = width; self.height = height }
    public static let zero = AWCStepperRect()
    public var isEmpty: Bool { x == 0 && y == 0 && width == 0 && height == 0 }
    func offset(_ dx: Double, _ dy: Double) -> AWCStepperRect { .init(x: x + dx, y: y + dy, width: width, height: height) }
    func mirrored(_ w: Double) -> AWCStepperRect { .init(x: w - x - width, y: y, width: width, height: height) }
}

public typealias AWCStepperRGBA = (r: Double, g: Double, b: Double, a: Double)

@inline(__always) func awcStepperLU(_ v: Double) -> Double { (v * 64 + 1e-7).rounded(.down) / 64 }
@inline(__always) func awcStepperLUCeil(_ v: Double) -> Double { (v * 64 - 1e-7).rounded(.up) / 64 }
/// LayoutUnit / 2 (truncating division of the raw value).
@inline(__always) func awcStepperHalf(_ v: Double) -> Double { ((v * 64).rounded() / 2).rounded(.towardZero) / 64 }

/// CSS colours: #rgb[a], #rrggbb[aa], rgb()/rgba(), color(srgb …).
public func awcStepperColor(_ css: String) -> AWCStepperRGBA? {
    let s = css.trimmingCharacters(in: .whitespaces).lowercased()
    if s == "transparent" { return (0, 0, 0, 0) }
    if s.hasPrefix("#") {
        var h = String(s.dropFirst())
        if h.count == 3 || h.count == 4 { h = h.map { "\($0)\($0)" }.joined() }
        guard h.count == 6 || h.count == 8, let v = UInt64(h, radix: 16) else { return nil }
        let rgb = h.count == 8 ? v >> 8 : v
        return (Double((rgb >> 16) & 255) / 255, Double((rgb >> 8) & 255) / 255, Double(rgb & 255) / 255, h.count == 8 ? Double(v & 255) / 255 : 1)
    }
    func nums(_ body: Substring) -> [String] { body.split(whereSeparator: { ", /".contains($0) }).map(String.init).filter { !$0.isEmpty } }
    if s.hasPrefix("rgb"), let o = s.firstIndex(of: "("), let c = s.lastIndex(of: ")") {
        let n = nums(s[s.index(after: o)..<c])
        guard n.count >= 3 else { return nil }
        func ch(_ v: String) -> Double { v.hasSuffix("%") ? (Double(v.dropLast()) ?? 0) / 100 : (Double(v) ?? 0) / 255 }
        let a = n.count > 3 ? (n[3].hasSuffix("%") ? (Double(n[3].dropLast()) ?? 100) / 100 : Double(n[3]) ?? 1) : 1
        return (ch(n[0]), ch(n[1]), ch(n[2]), a)
    }
    if s.hasPrefix("color(srgb"), let c = s.lastIndex(of: ")") {
        let n = nums(s[s.index(s.startIndex, offsetBy: 10)..<c])
        guard n.count >= 3 else { return nil }
        return (Double(n[0]) ?? 0, Double(n[1]) ?? 0, Double(n[2]) ?? 0, n.count > 3 ? Double(n[3]) ?? 1 : 1)
    }
    return nil
}

/// CSS `cubic-bezier()` timing function.
public func awcStepperBezier(_ x1: Double, _ y1: Double, _ x2: Double, _ y2: Double) -> (Double) -> Double {
    let cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx
    let cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by
    func sx(_ t: Double) -> Double { ((ax * t + bx) * t + cx) * t }
    func sy(_ t: Double) -> Double { ((ay * t + by) * t + cy) * t }
    func dx(_ t: Double) -> Double { (3 * ax * t + 2 * bx) * t + cx }
    func solve(_ x: Double) -> Double {
        var t = x
        for _ in 0..<8 { let e = sx(t) - x; if abs(e) < 1e-7 { return t }; let d = dx(t); if abs(d) < 1e-6 { break }; t -= e / d }
        var lo = 0.0, hi = 1.0; t = x
        while lo < hi { let v = sx(t); if abs(v - x) < 1e-7 { return t }; if x > v { lo = t } else { hi = t }; t = (lo + hi) / 2; if hi - lo < 1e-9 { break } }
        return t
    }
    return { x in x <= 0 ? 0 : x >= 1 ? 1 : sy(solve(x)) }
}

public enum AWCStepperEasing {
    public static let effects = awcStepperBezier(0.34, 0.80, 0.34, 1.00)     // spring-effects-default
    public static let spatial = awcStepperBezier(0.38, 1.21, 0.22, 1.00)     // spring-spatial-default
    public static let collapse = awcStepperBezier(0.3, 0, 0.8, 0.15)         // emphasized-accelerate
    public static let linear: (Double) -> Double = { Swift.max(0, Swift.min(1, $0)) }
}

/// CSS transitions keyed by property: a target change starts a transition from the current (possibly mid-flight)
/// value; returning to the running transition's start value reverses it with the shortened duration (CSS Transitions
/// §3); discretely animated properties (visibility) hold their old value through the delay and at progress 0; the
/// error pulse is a keyframe animation started when its class appears.
public final class AWCStepperMotion {
    private struct Tr { var from: [Double], to: [Double], start: Double, dur: Double, ease: (Double) -> Double, rev: [Double], short: Double }
    private struct Disc { var from: Bool, to: Bool, start: Double, dur: Double, delay: Double }
    private var run: [String: Tr] = [:]
    private var target: [String: [Double]] = [:]
    private var disc: [String: Disc] = [:]
    private var keyframes: [String: (start: Double, dur: Double)] = [:]
    /// Every keyframe animation start (key, time), in order — the parity harness compares them with Chrome's animations.
    public private(set) var started: [(key: String, at: Double)] = []
    public init() {}
    private func eased(_ t: Tr, _ now: Double) -> Double { t.dur <= 0 ? 1 : t.ease(Swift.max(0, Swift.min(1, (now - t.start) / t.dur))) }
    private func sample(_ t: Tr, _ now: Double) -> [Double] { let e = eased(t, now); return zip(t.from, t.to).map { $0 + ($1 - $0) * e } }
    public func animate(_ key: String, _ value: [Double], now: Double, duration: Double, ease: @escaping (Double) -> Double) -> [Double] {
        let prev = target.updateValue(value, forKey: key)
        guard let prev else { run[key] = nil; return value }
        if value != prev {
            let r = run[key]
            let cur = r.map { sample($0, now) } ?? prev
            if cur == value { run[key] = nil }
            else if let r, value == r.rev {
                let f = Swift.min(1, abs(eased(r, now) * r.short + 1 - r.short))
                run[key] = Tr(from: cur, to: value, start: now, dur: duration * f, ease: ease, rev: r.to, short: f)
            } else {
                run[key] = Tr(from: cur, to: value, start: now, dur: duration, ease: ease, rev: cur, short: 1)
            }
        }
        return run[key].map { sample($0, now) } ?? value
    }
    public func discrete(_ key: String, _ value: Bool, now: Double, duration: Double, delay: Double) -> Bool {
        guard var r = disc[key] else { disc[key] = Disc(from: value, to: value, start: now, dur: 0, delay: 0); return value }
        if value != r.to { r = Disc(from: discreteAt(r, now), to: value, start: now, dur: duration, delay: delay); disc[key] = r }
        return discreteAt(r, now)
    }
    private func discreteAt(_ r: Disc, _ now: Double) -> Bool {
        let dt = now - r.start
        return dt < r.delay || (r.dur > 0 && dt - r.delay <= 0) ? r.from : r.to
    }
    /// Start time of a keyframe animation while `on` (nil when off); turning on again restarts it.
    public func keyframe(_ key: String, on: Bool, now: Double, duration: Double = 300) -> Double? {
        if on { if keyframes[key] == nil { keyframes[key] = (now, duration); started.append((key, now)) } } else { keyframes[key] = nil }
        return keyframes[key]?.start
    }
    public func running(_ key: String, now: Double) -> Bool { run[key].map { now < $0.start + $0.dur } ?? false }
    /// Whether anything (a transition, the pulse, a delayed visibility flip) is still moving at `now`.
    public func active(_ now: Double) -> Bool {
        run.values.contains { now < $0.start + $0.dur } || disc.values.contains { now <= $0.start + $0.delay + $0.dur } || keyframes.values.contains { now < $0.start + $0.dur }
    }
    public func reset() { run.removeAll(); target.removeAll(); disc.removeAll(); keyframes.removeAll(); started.removeAll() }
}

/// md-step-glyph-in (500ms spring, spatial easing per keyframe interval, fill both): scale 0 → 1.18 (60%) → 1, opacity 0 → 1 (60%).
func awcStepperGlyphIn(_ dt: Double) -> (scale: Double, opacity: Double) {
    let x = Swift.max(0, Swift.min(1, dt / 500))
    if x <= 0.6 { let e = AWCStepperEasing.spatial(x / 0.6); return (1.18 * e, Swift.max(0, Swift.min(1, e))) }
    let e = AWCStepperEasing.spatial((x - 0.6) / 0.4); return (1.18 - 0.18 * e, 1)
}
/// md-step-content-enter (a lazy panel's mount; expand duration, spatial easing): opacity 0 → 1, translateY(-6px) → 0.
func awcStepperContentEnter(_ dt: Double, _ duration: Double) -> (opacity: Double, dy: Double) {
    let e = AWCStepperEasing.spatial(duration <= 0 ? 1 : Swift.max(0, Swift.min(1, dt / duration)))
    return (Swift.max(0, Swift.min(1, e)), -6 * (1 - e))
}
/// md-step-enter (the step's mount; 300ms effects easing, `backwards` fill, delay index × 40ms): opacity 0 → 1.
func awcStepperEnter(_ dt: Double, delay: Double) -> Double {
    if dt < delay { return 0 }
    return Swift.max(0, Swift.min(1, AWCStepperEasing.effects(Swift.min(1, (dt - delay) / 300))))
}

/// md-step-error-pulse: scale 1 → 1.08 (40%) → 1 over 300ms, effects easing per keyframe interval, fill both.
func awcStepperErrorPulse(_ dt: Double) -> Double {
    let x = Swift.max(0, Swift.min(1, dt / 300))
    return x <= 0.4 ? 1 + 0.08 * AWCStepperEasing.effects(x / 0.4) : 1.08 - 0.08 * AWCStepperEasing.effects((x - 0.4) / 0.6)
}

/// The `--md-step-*` hooks (inherited from the stepper) and `--md-stepper-gap`.
public struct AWCStepperHooks: Equatable, Sendable {
    public var values: [String: String] = [:]
    public init(_ values: [String: String] = [:]) { self.values = values }
    /// From an inline style (`--md-step-active-color: #E65100; …`).
    public init(style: String) {
        var out: [String: String] = [:]
        for decl in style.split(separator: ";") {
            let kv = decl.split(separator: ":", maxSplits: 1).map { $0.trimmingCharacters(in: .whitespaces) }
            if kv.count == 2, kv[0].hasPrefix("--") { out[kv[0]] = kv[1] }
        }
        values = out
    }
    func step(_ k: String) -> String? { values["--md-step-" + k].flatMap { $0.isEmpty ? nil : $0 } }
    func px(_ k: String) -> Double? { step(k).flatMap(awcStepperPx) }
    /// A CSS time hook (`350ms`, `0.35s`) in milliseconds.
    func ms(_ k: String) -> Double? {
        guard let v = step(k)?.trimmingCharacters(in: .whitespaces).lowercased() else { return nil }
        if v.hasSuffix("ms") { return Double(v.dropLast(2)) }
        if v.hasSuffix("s") { return Double(v.dropLast()).map { $0 * 1000 } }
        return nil
    }
    var stepperGap: Double { values["--md-stepper-gap"].flatMap(awcStepperPx) ?? 0 }
    /// A step's hooks: the stepper's, then the step's own inline `style` (nearer wins).
    func merging(style: String) -> AWCStepperHooks { style.isEmpty ? self : AWCStepperHooks(values.merging(AWCStepperHooks(style: style).values) { _, new in new }) }
}

func awcStepperPx(_ raw: String) -> Double? {
    var s = raw.trimmingCharacters(in: .whitespaces)
    if s.hasSuffix("px") { s.removeLast(2) }
    return Double(s)
}

/// Tokens: the theme's resolved `--md-sys-*` values plus the density rung payload (tokens.css §12: the spacing tokens
/// a `data-density` / `density` rung re-declares).
public struct AWCStepperTheme {
    public var tokens: [String: String]
    public init(tokens: [String: String]) { self.tokens = tokens }
    public static let rungs: [Int: [String: Double]] = [
        -2: ["inset-md": 8, "inset-lg": 12, "inset-xl": 20, "gap-md": 8, "gap-lg": 12],
        -3: ["inset-sm": 4, "inset-md": 8, "inset-lg": 12, "inset-xl": 16, "gap-sm": 4, "gap-md": 8, "gap-lg": 12],
        -4: ["inset-sm": 4, "inset-md": 8, "inset-lg": 8, "inset-xl": 16, "gap-xs": 2, "gap-sm": 4, "gap-md": 4, "gap-lg": 8],
    ]
    func spacing(_ name: String, rung: Double, _ fallback: Double) -> Double {
        if let v = Self.rungs[Int(rung)]?[name] { return v }
        return tokens["--md-sys-spacing-" + name].flatMap(awcStepperPx) ?? fallback
    }
    func color(_ role: String, _ fallback: String) -> AWCStepperRGBA {
        awcStepperColor(tokens["--md-sys-color-" + role] ?? fallback) ?? awcStepperColor(fallback)!
    }
}

/// Resolved values for one element: its density scale and rung, tokens and hooks.
struct AWCStepperEnv {
    let s: Double, theme: AWCStepperTheme, hooks: AWCStepperHooks
    func sp(_ name: String, _ d: Double) -> Double { theme.spacing(name, rung: s, d) }
    func c(_ hook: String, _ role: String, _ d: String) -> AWCStepperRGBA {
        hooks.step(hook).flatMap(awcStepperColor) ?? theme.color(role, d)
    }
}

func awcStepperDensity(_ local: Double, _ inherited: Double) -> Double { [-1.0, -2, -3, -4].contains(local) ? local : inherited }

/// Text measurement: the CSS advance width of `text` in Roboto at `size` / CSS `weight` (the layout rounds it up to
/// LayoutUnit like Chrome's intrinsic widths).
public typealias AWCStepperMeasure = (_ text: String, _ size: Double, _ weight: Double, _ letterSpacing: Double) -> Double

#if canImport(CoreText)
/// CoreText measurement with the bundled Roboto 400/500/700 (CSS font matching: 600 → 700).
public func awcStepperCoreTextMeasure(_ text: String, _ size: Double, _ weight: Double, _ letterSpacing: Double) -> Double {
    _ = AWCNativeFonts.labelFamily(regular: true)
    let name = weight > 500 ? "Roboto-Bold" : weight > 400 ? "Roboto-Medium" : "Roboto-Regular"
    let font = CTFontCreateWithName(name as CFString, size, nil)
    let attr = NSAttributedString(string: text, attributes: [NSAttributedString.Key(kCTFontAttributeName as String): font])
    let line = CTLineCreateWithAttributedString(attr)
    return CTLineGetTypographicBounds(line, nil, nil, nil) + letterSpacing * Double(text.count)
}
#endif

/// Pointer state the host tracks (the Web's :hover / :active on a header).
public struct AWCStepperPointer: Equatable { public var hover: Int? = nil, pressed: Int? = nil; public init() {} }

// MARK: paint

public struct AWCStepPartPaint {
    public var rect = AWCStepperRect.zero
}

public struct AWCStepPaint {
    public var index = 0
    public var hostRect = AWCStepperRect.zero
    public var inner = AWCStepperRect.zero, indicator = AWCStepperRect.zero, stateLayer = AWCStepperRect.zero, bubble = AWCStepperRect.zero
    public var indicatorOpacity = 1.0
    /// The focus ring (2px surface + 5px secondary box-shadow) on the indicator.
    public var focusRing: (inner: AWCStepperRGBA, outer: AWCStepperRGBA)? = nil
    public var stateLayerVisible = true, stateOpacity = 0.0, stateColor: AWCStepperRGBA = (0, 0, 0, 0)
    public var dot = false
    public var bubbleColor: AWCStepperRGBA = (0, 0, 0, 0), bubbleText: AWCStepperRGBA? = nil
    public var scale = 1.0, transformNone = true
    /// Halo (box-shadow 0 0 0 spread): colour with its alpha, spread.
    public var halo: (color: AWCStepperRGBA, spread: Double)? = nil
    public var number: String? = nil, glyph: String? = nil, glyphFilled = false
    /// md-step-glyph-in on the glyph (scale about the bubble centre, opacity); md-step-enter on the whole step (opacity).
    public var glyphScale = 1.0, glyphOpacity = 1.0, hostOpacity = 1.0
    /// md-step-content-enter on a lazy panel's content (opacity, translateY).
    public var contentOpacity = 1.0, contentDY = 0.0
    public var bubbleSize = 32.0, glyphSize = 17.92, bubbleFontSize = 14.0
    public var text: AWCStepperRect? = nil, textOpacity = 1.0
    public struct Line { public var part: String, rect: AWCStepperRect, color: AWCStepperRGBA, fontSize: Double, lineHeight: Double, weight: Double, text: String, lines: Int, italic: Bool
        /// The text broken into its painted lines (the horizontal label clamps at 2 with an ellipsis).
        public var wrapped: [String] = [] }
    public var lines: [Line] = []
    public var connector: (rect: AWCStepperRect, color: AWCStepperRGBA, fill: Double, fillColor: AWCStepperRGBA, vertical: Bool)? = nil
    public var hasLeadingConnector = false
    public var panel: (rect: AWCStepperRect, opacity: Double, visible: Bool, gridRows: Double?, contentOrigin: (x: Double, y: Double), contentWidth: Double)? = nil
    public var actions: AWCStepperRect? = nil
    public var disabled = false, readonly = false, reachableControl = true
    public var hasPanel = false, renderPanel = false
}

public struct AWCStepperPaint {
    public var host = AWCStepperRect.zero
    public var list: AWCStepperRect? = nil, content = AWCStepperRect.zero
    public var nav: AWCStepperRect? = nil, mobileNav: AWCStepperRect? = nil, mobileProgress: AWCStepperRect? = nil
    public var navButtons: (back: AWCStepperRect, next: AWCStepperRect)? = nil
    public var mobileDots: [(rect: AWCStepperRect, color: AWCStepperRGBA, scale: Double)] = []
    public var mobileText: (rect: AWCStepperRect, text: String, color: AWCStepperRGBA)? = nil
    public var steps: [AWCStepPaint] = []
    public var hideList = false
    public var buttonDensity = 0.0
}

/// Inputs from the host and its children.
public struct AWCStepperLayoutInput {
    public var width: Double
    public var rtl = false
    public var dark = false
    public var globalDensity = 0.0
    /// Height of the `content` slot child (nil: nothing slotted).
    public var slotHeight: Double? = nil
    /// Each step's own content height at the panel's content width (index → height).
    public var contentHeights: [Int: Double] = [:]
    /// Each rendered panel's natural inner height as the host measured it (padding, content, actions); overrides
    /// the computation from `contentHeights`.
    public var panelInnerHeights: [Int: Double] = [:]
    public var defaultContentHeight = 0.0
    /// Viewport width for md-step.css `@media (max-width: 599px)` (the compact horizontal row).
    public var viewportWidth = 1200.0
    public var tokens: [String: String] = [:]
    public var hooks = AWCStepperHooks()
    /// Widths of the built-in nav buttons (Back, Continue/Finish) when the host measured them; else from md-button's sm metrics.
    public var buttonWidths: (back: Double, next: Double)? = nil
    public init(width: Double) { self.width = width }
}

public enum AWCStepperLayout {
    public static func buttonHeight(_ s: Double) -> Double { Swift.max(24, 40 + 4 * s) }
    /// md-button size sm: min-width max(40, 58 + 4s), padding-inline max(8, 16 + s), label-large 14 (+.5s, floor 12), letter-spacing .1.
    public static func buttonWidth(_ label: String, _ s: Double, measure: AWCStepperMeasure) -> Double {
        let fs = Swift.max(12, 14 + 0.5 * s)
        return Swift.max(Swift.max(40, 58 + 4 * s), awcStepperLUCeil(measure(label, fs, 500, 0.1)) + 2 * Swift.max(8, 16 + s))
    }

    struct Text { var w: Double, h: Double, items: [(part: String, w: Double, h: Double, fs: Double, lh: Double, weight: Double, text: String, lines: Int, wrapped: [String])] }

    static func wrap(_ text: String, _ fs: Double, _ weight: Double, _ avail: Double, _ measure: AWCStepperMeasure) -> [String] {
        var lines: [String] = [], cur = ""
        for w in text.split(separator: " ", omittingEmptySubsequences: false).map(String.init) {
            let cand = cur.isEmpty ? w : cur + " " + w
            if !cur.isEmpty && awcStepperLUCeil(measure(cand, fs, weight, 0)) > avail + 1e-9 { lines.append(cur); cur = w } else { cur = cand }
        }
        if !cur.isEmpty { lines.append(cur) }
        return lines
    }

    static func textMetrics(_ m: AWCStepperModel, _ i: Int, _ e: AWCStepperEnv, avail: Double, horizontal: Bool, compact: Bool, measure: AWCStepperMeasure) -> Text? {
        let s = m.steps[i]
        var labFs = Swift.max(11, 14 + 0.5 * e.s), labLh = Swift.max(16, 20 + e.s)
        if compact && horizontal { labFs = 12; labLh = 16 }
        let capFs = Swift.max(10, 12 + 0.5 * e.s), capLh = Swift.max(14, 16 + 0.5 * e.s)
        let weight: Double = m.isActive(i) ? 600 : 500
        let fontWeight: Double = weight > 500 ? 700 : 500
        let supporting = s.error && !s.errorText.isEmpty ? s.errorText : s.description
        let opt = s.optional ? m.p.optionalWord : ""
        var items: Text = Text(w: 0, h: 0, items: [])
        if !s.label.isEmpty {
            var w = awcStepperLUCeil(measure(s.label, labFs, fontWeight, 0)), lines = 1, wrapped = [s.label]
            if w > avail {
                let ls = wrap(s.label, labFs, fontWeight, avail, measure); lines = horizontal ? Swift.min(2, ls.count) : ls.count; w = avail
                wrapped = Array(ls.prefix(lines)); if ls.count > lines, let last = wrapped.popLast() { wrapped.append(last + "…") }
            }
            items.items.append(("label", w, Double(lines) * labLh, labFs, labLh, weight, s.label, lines, wrapped))
        }
        let captions = !(compact && horizontal)      // the compact row hides the optional / supporting captions
        if !opt.isEmpty && captions {
            let w = awcStepperLUCeil(measure(opt, capFs, 400, 0))
            items.items.append(("optional", Swift.min(w, avail), capLh, capFs, capLh, 400, opt, 1, [opt]))
        }
        if !supporting.isEmpty && captions {
            var w = awcStepperLUCeil(measure(supporting, capFs, 400, 0)), lines = 1, wrapped = [supporting]
            if w > avail { wrapped = wrap(supporting, capFs, 400, avail, measure); lines = wrapped.count; w = avail }
            items.items.append(("description", w, Double(lines) * capLh, capFs, capLh, 400, supporting, lines, wrapped))
        }
        guard !items.items.isEmpty else { return nil }
        items.w = items.items.map(\.w).max() ?? 0
        items.h = items.items.map(\.h).reduce(0, +) + 2 * Double(items.items.count - 1)
        return items
    }

    /// The step's visual targets, run through the CSS transitions (motion nil: settled values).
    struct Visual {
        var bg: AWCStepperRGBA, fg: AWCStepperRGBA?, scale: Double, transformNone: Bool, halo: (AWCStepperRGBA, Double)?
        var label: AWCStepperRGBA, optional: AWCStepperRGBA, description: AWCStepperRGBA
        var state: Double, stateColor: AWCStepperRGBA, connector: AWCStepperRGBA, filled: AWCStepperRGBA, fill: Double
        var panel: Double, panelVisible: Bool, panelOpacity: Double
        var glyphScale = 1.0, glyphOpacity = 1.0, hostOpacity = 1.0, contentOpacity = 1.0, contentDY = 0.0
    }

    static func resolve(_ m: AWCStepperModel, _ i: Int, _ e: AWCStepperEnv, pointer: AWCStepperPointer, motion: AWCStepperMotion?, now: Double, reduced: Bool) -> Visual {
        let s = m.steps[i], dot = m.p.indicator == "dot", active = m.isActive(i)
        func anim(_ k: String, _ v: [Double], _ dur: Double, _ ease: @escaping (Double) -> Double) -> [Double] {
            guard let motion else { return v }
            return motion.animate("s\(i).\(k)", v, now: now, duration: reduced ? 0.01 : dur, ease: ease)
        }
        func rgba(_ c: AWCStepperRGBA) -> [Double] { [c.r, c.g, c.b, c.a] }
        func back(_ v: [Double]) -> AWCStepperRGBA { (v[0], v[1], v[2], v[3]) }
        let pending = e.hooks.step("indicator-color").flatMap(awcStepperColor) ?? (dot ? e.theme.color("outline", "#79747E") : e.theme.color("surface-container-highest", "#E6E0E9"))
        var bg = pending, fg = e.c("indicator-text", "on-surface-variant", "#49454F")
        if active { bg = e.c("active-color", "primary", "#6750A4"); fg = e.c("active-text", "on-primary", "#FFFFFF") }
        if s.completed { bg = e.c("completed-color", "primary", "#6750A4"); fg = e.c("completed-text", "on-primary", "#FFFFFF") }
        if s.error { bg = e.c("error-color", "error", "#B3261E"); fg = e.c("error-text", "on-error", "#FFFFFF") }
        let bgNow = back(anim("bg", rgba(bg), 200, AWCStepperEasing.effects))
        let fgNow: AWCStepperRGBA? = dot ? nil : back(anim("fg", rgba(fg), 200, AWCStepperEasing.effects))
        // transform: the active bubble springs to 1.12 (dot 1.4; none under reduced motion); an error bubble's pulse
        // animation (fill: both) overrides the transform from its start on.
        let base = active && !reduced ? (dot ? 1.4 : 1.12) : 1.0
        let sc = anim("scale", [base], 500, AWCStepperEasing.spatial)[0]
        var pulse: Double? = nil
        if !dot && s.error && !reduced {
            if let motion { pulse = awcStepperErrorPulse(now - (motion.keyframe("s\(i).pulse", on: true, now: now) ?? now)) } else { pulse = 1 }
        } else { _ = motion?.keyframe("s\(i).pulse", on: false, now: now) }
        let running = motion?.running("s\(i).scale", now: now) ?? false
        let transformNone = pulse == nil && base == 1 && abs(sc - 1) < 1e-12 && !running
        let haloColor = e.c("active-halo-color", "primary", "#6750A4")
        let pct = reduced ? 0.25 : (dot ? 0.18 : 0.14)
        let h = anim("halo", active ? [haloColor.a * pct, 3] : [0, 0], 500, AWCStepperEasing.spatial)
        var label = e.c("label-color", "on-surface-variant", "#49454F")
        if active { label = e.c("label-active-color", "on-surface", "#1C1B1F") }
        if s.error { label = e.c("error-color", "error", "#B3261E") }
        let optional = e.c("description-color", "on-surface-variant", "#49454F")
        // :active (.12) > :hover (.08) > :focus-visible (.12) by specificity; hover / active skip aria-disabled headers.
        // A disabled or readonly state layer is display:none: its computed opacity switches without a transition.
        let dis = m.effectivelyDisabled(i), ro = m.p.readonly
        var sl = 0.0
        if !dis && pointer.pressed == i { sl = 0.12 } else if !dis && pointer.hover == i { sl = 0.08 } else if m.focusVisible == i { sl = 0.12 }
        let state: Double = dis || ro ? sl : anim("state", [sl], 200, AWCStepperEasing.effects)[0]
        // --md-step-connector-duration / -expand-duration / -collapse-duration (350 / 500 / 200ms).
        let fillDur = e.hooks.ms("connector-duration") ?? 350, expandDur = e.hooks.ms("expand-duration") ?? 500, collapseDur = e.hooks.ms("collapse-duration") ?? 200
        let fill: Double = anim("fill", [i < m.active ? 1.0 : 0.0], fillDur, AWCStepperEasing.linear)[0]
        let open = active
        let frac: Double = m.p.lazy ? (open ? 1 : 0) : anim("panel", [open ? 1 : 0], open ? expandDur : collapseDur, open ? AWCStepperEasing.spatial : AWCStepperEasing.collapse)[0]
        var visible = open
        if !m.p.lazy, let motion {
            visible = reduced ? motion.discrete("s\(i).vis", open, now: now, duration: 0.01, delay: 0)
                              : motion.discrete("s\(i).vis", open, now: now, duration: 0, delay: open ? 0 : collapseDur)   // visibility 0s / 0s linear <collapse>
        }
        // Keyframe animations (none under reduced motion): the glyph span scales in when it shows with the completed / error
        // class; a lazy panel's content fades and slides in on mount; the step itself fades in on mount (index × 40ms).
        var glyphScale = 1.0, glyphOpacity = 1.0, hostOpacity = 1.0, contentOpacity = 1.0, contentDY = 0.0
        if let motion {
            if let t = motion.keyframe("s\(i).glyph", on: !reduced && !dot && (s.completed || s.error) && m.glyph(i) != nil, now: now, duration: 500) {
                (glyphScale, glyphOpacity) = awcStepperGlyphIn(now - t)
            }
            if let t = motion.keyframe("s\(i).content", on: !reduced && m.p.lazy && m.renderPanel(i), now: now, duration: expandDur) {
                (contentOpacity, contentDY) = awcStepperContentEnter(now - t, expandDur)
            }
            if let t = motion.keyframe("s\(i).mount", on: !reduced, now: now, duration: 300 + 40 * Double(i)) { hostOpacity = awcStepperEnter(now - t, delay: 40 * Double(i)) }
        }
        // (Split up: one expression of this size is beyond the Swift type checker.)
        let halo: (AWCStepperRGBA, Double)? = h[0] > 0 || h[1] > 0 ? ((r: haloColor.r, g: haloColor.g, b: haloColor.b, a: h[0]), h[1]) : nil
        let labelNow: AWCStepperRGBA = back(anim("label", rgba(label), 200, AWCStepperEasing.effects))
        let description: AWCStepperRGBA = s.error ? e.c("error-color", "error", "#B3261E") : optional
        let stateColor: AWCStepperRGBA = e.c("state-layer-color", "on-surface", "#1C1B1F")
        let connector: AWCStepperRGBA = e.c("connector-color", "outline-variant", "#CAC4D0")
        let filled: AWCStepperRGBA = e.c("connector-filled-color", "primary", "#6750A4")
        let panelOpacity: Double = m.p.lazy ? 1 : anim("popacity", [open ? 1 : 0], open ? 200 : collapseDur, open ? AWCStepperEasing.effects : AWCStepperEasing.collapse)[0]
        let panel: Double = Swift.min(1, Swift.max(0, frac))
        let scale: Double = pulse ?? sc
        return Visual(bg: bgNow, fg: fgNow, scale: scale, transformNone: transformNone, halo: halo, label: labelNow, optional: optional,
                      description: description, state: state, stateColor: stateColor, connector: connector, filled: filled,
                      fill: fill, panel: panel, panelVisible: visible, panelOpacity: panelOpacity,
                      glyphScale: glyphScale, glyphOpacity: glyphOpacity, hostOpacity: hostOpacity, contentOpacity: contentOpacity, contentDY: contentDY)
    }

    struct Indicator { var size: Double, h: Double, ring: Double }
    static func indicator(_ m: AWCStepperModel, _ e: AWCStepperEnv, compact: Bool, horizontal: Bool) -> Indicator {
        let dot = m.p.indicator == "dot"
        let size = e.hooks.px("indicator-size") ?? (compact && horizontal ? 28 : Swift.max(24, 32 + 2 * e.s))
        return Indicator(size: size, h: dot ? 10 : size, ring: e.hooks.px("indicator-ring") ?? Swift.max(4, 8 + e.s))
    }

    struct Header { var inner: AWCStepperRect, pad: Double, pin: Double, gap: Double, indw: Double, ind: Indicator, text: Text? }
    static func header(_ m: AWCStepperModel, _ i: Int, _ e: AWCStepperEnv, colw: Double, compact: Bool, measure: AWCStepperMeasure) -> Header {
        let ind = indicator(m, e, compact: compact, horizontal: true)
        let pad = Swift.max(0, 4 + e.s), pin = compact ? e.sp("inset-xs", 4) : e.sp("inset-sm", 8)
        let gap = compact ? e.sp("gap-xs", 4) : Swift.max(2, 6 + e.s), indw = ind.h + 2 * ind.ring
        let tm = textMetrics(m, i, e, avail: colw - 2 * pin, horizontal: true, compact: compact, measure: measure)
        let cw = Swift.max(indw, tm?.w ?? 0)
        let iw = Swift.min(colw, cw + 2 * pin), ih = pad + indw + (tm.map { gap + $0.h } ?? 0)
        return Header(inner: AWCStepperRect(x: awcStepperHalf(colw - iw), y: 0, width: iw, height: ih), pad: pad, pin: pin, gap: gap, indw: indw, ind: ind, text: tm)
    }

    static func parts(_ m: AWCStepperModel, _ i: Int, _ e: AWCStepperEnv, _ v: Visual, inner: AWCStepperRect, ind: AWCStepperRect, ih: Indicator,
                      textX: Double, textY: Double, tm: Text?, horizontal: Bool) -> AWCStepPaint {
        var p = AWCStepPaint()
        p.index = i
        let dis = m.effectivelyDisabled(i), ro = m.p.readonly
        p.disabled = dis; p.readonly = ro; p.hasPanel = m.hasPanel(i); p.renderPanel = m.renderPanel(i)
        p.inner = inner; p.indicator = ind; p.indicatorOpacity = dis ? 0.38 : 1
        if m.focusVisible == i && !ro { p.focusRing = (e.theme.color("surface", "#FEF7FF"), e.theme.color("secondary", "#625B71")) }
        p.stateLayerVisible = !(dis || ro); p.stateLayer = p.stateLayerVisible ? ind : .zero
        p.stateOpacity = v.state; p.stateColor = v.stateColor
        p.dot = m.p.indicator == "dot"
        let h = ih.h
        let bx = ind.x + awcStepperHalf(ind.width - h), by = ind.y + awcStepperHalf(ind.height - h)
        p.scale = v.scale; p.transformNone = v.transformNone
        p.glyphScale = v.glyphScale; p.glyphOpacity = v.glyphOpacity; p.hostOpacity = v.hostOpacity
        p.contentOpacity = v.contentOpacity; p.contentDY = v.contentDY
        p.bubble = AWCStepperRect(x: bx + h / 2 - h * v.scale / 2, y: by + h / 2 - h * v.scale / 2, width: h * v.scale, height: h * v.scale)
        p.bubbleSize = h; p.glyphSize = ih.size * 0.56
        p.bubbleColor = v.bg; p.bubbleText = v.fg
        if let hl = v.halo { p.halo = (hl.0, hl.1) }
        let g = m.glyph(i)
        p.glyph = g; p.number = p.dot || g != nil ? nil : String(i + 1)
        p.glyphFilled = m.isActive(i) || m.steps[i].completed || m.steps[i].error
        if let tm {
            p.text = AWCStepperRect(x: textX, y: textY, width: tm.w, height: tm.h); p.textOpacity = dis ? 0.38 : 1
            var y = textY
            for it in tm.items {
                let w = horizontal ? it.w : tm.w
                let x = textX + (horizontal ? awcStepperHalf(tm.w - w) : 0)
                let color = it.part == "label" ? v.label : it.part == "optional" ? v.optional : v.description
                p.lines.append(.init(part: it.part, rect: AWCStepperRect(x: x, y: y, width: w, height: it.h), color: color, fontSize: it.fs,
                                     lineHeight: it.lh, weight: it.weight, text: it.text, lines: it.lines, italic: it.part == "optional", wrapped: it.wrapped))
                y += it.h + 2
            }
        }
        return p
    }

    public static func layout(_ m: AWCStepperModel, _ input: AWCStepperLayoutInput, measure: AWCStepperMeasure, motion: AWCStepperMotion? = nil,
                              now: Double = 0, reduced: Bool = false, pointer: AWCStepperPointer = AWCStepperPointer()) -> AWCStepperPaint {
        let p = m.p, n = m.count, W = input.width
        let sd = awcStepperDensity(p.density, input.globalDensity)
        let theme = AWCStepperTheme(tokens: input.tokens)
        let senv = AWCStepperEnv(s: sd, theme: theme, hooks: input.hooks)
        let horizontal = p.orientation == "horizontal", mobile = p.variant == "mobile"
        let compact = input.viewportWidth < 600
        // `:host(.md-stepper--mobile) .md-stepper__list { display: none }` loses to the panel-mode grid rule (higher
        // specificity): a mobile stepper whose steps carry content still shows its header row.
        let hideList = mobile && !(horizontal && m.panelMode == "step")
        let envs = m.steps.map { AWCStepperEnv(s: awcStepperDensity($0.density, sd), theme: theme, hooks: input.hooks.merging(style: $0.style)) }
        let vis = (0..<n).map { resolve(m, $0, envs[$0], pointer: pointer, motion: motion, now: now, reduced: reduced) }
        var out = AWCStepperPaint()
        out.hideList = hideList
        out.buttonDensity = sd
        func contentH(_ i: Int) -> Double { m.steps[i].hasContent ? (input.contentHeights[i] ?? input.defaultContentHeight) : 0 }
        func panelInner(_ i: Int, _ horizontalMode: Bool) -> Double {
            if let h = input.panelInnerHeights[i] { return h }
            let e = envs[i]
            if horizontalMode { return (e.hooks.px("panel-padding-block-start") ?? e.sp("inset-lg", 16)) + contentH(i) + e.sp("inset-lg", 16) }
            return e.sp("inset-xs", 4) + contentH(i) + (m.navActions(i) ? e.sp("gap-lg", 16) + buttonHeight(e.s) : 0) + e.sp("inset-lg", 16)
        }
        var steps: [AWCStepPaint] = []
        var listH = 0.0
        if hideList || horizontal {
            let xs = (0...Swift.max(n, 0)).map { k in n == 0 ? 0 : awcStepperLU(W * Double(k) / Double(n)) }
            let cols = (0..<n).map { xs[$0 + 1] - xs[$0] }
            let hds = (0..<n).map { header(m, $0, envs[$0], colw: hideList ? W : cols[$0], compact: compact, measure: measure) }
            let row1 = hds.map(\.inner.height).max() ?? 0
            for i in 0..<n {
                let hd = hds[i], colx = hideList ? 0 : xs[i], colw = hideList ? W : cols[i], e = envs[i]
                let inner = hd.inner.offset(colx, 0)
                let ind = AWCStepperRect(x: inner.x + awcStepperHalf(inner.width - hd.indw), y: inner.y + hd.pad, width: hd.indw, height: hd.indw)
                let tx = inner.x + hd.pin + (hd.text.map { awcStepperHalf(inner.width - 2 * hd.pin - $0.w) } ?? 0)
                var sp = parts(m, i, e, vis[i], inner: inner, ind: ind, ih: hd.ind, textX: tx, textY: ind.y + hd.indw + hd.gap, tm: hd.text, horizontal: true)
                if !m.isLast(i) {
                    let th = e.hooks.px("connector-thickness") ?? Swift.max(2, 4 + 0.5 * e.s)
                    let gap = compact ? 8 : Swift.max(4, 10 + e.s)
                    let top = hd.pad + hd.ind.ring + hd.ind.h / 2
                    sp.connector = (AWCStepperRect(x: colx + awcStepperLU(colw / 2) + hd.ind.h / 2 + gap, y: top - th / 2, width: colw - hd.ind.h - 2 * gap, height: th),
                                    vis[i].connector, vis[i].fill, vis[i].filled, false)
                }
                let grid = m.panelMode == "step"
                sp.hostRect = grid && m.hasPanel(i) ? .zero : AWCStepperRect(x: colx, y: 0, width: colw, height: hd.inner.height)
                steps.append(sp)
            }
            if hideList {
                for i in steps.indices {
                    // No box (display: none list): every rect is empty and the transform resolves to none.
                    var sp = steps[i]
                    sp.hostRect = .zero; sp.inner = .zero; sp.indicator = .zero; sp.stateLayer = .zero; sp.bubble = .zero; sp.text = sp.text.map { _ in .zero }
                    sp.lines = sp.lines.map { var l = $0; l.rect = .zero; return l }
                    if let c = sp.connector { sp.connector = (.zero, c.color, c.fill, c.fillColor, c.vertical) }
                    sp.scale = 1; sp.transformNone = true
                    steps[i] = sp
                }
            } else if m.panelMode == "step" {
                var row2 = 0.0
                for i in 0..<n where m.renderPanel(i) {
                    let e = envs[i], inner = panelInner(i, true), h = awcStepperLU(inner * vis[i].panel)
                    row2 = Swift.max(row2, h)
                    let top = e.hooks.px("panel-padding-block-start") ?? e.sp("inset-lg", 16)
                    steps[i].panel = (AWCStepperRect(x: 0, y: row1, width: W, height: h), vis[i].panelOpacity, vis[i].panelVisible,
                                      m.p.lazy ? nil : h, (0, row1 + top), W)
                }
                listH = row1 + row2
            } else { listH = row1 }
        } else {
            var y = 0.0
            for i in 0..<n {
                let e = envs[i], v = vis[i]
                let ind = indicator(m, e, compact: false, horizontal: false)
                let indw = ind.h + 2 * ind.ring, gap = e.sp("gap-md", 12)
                let tm = textMetrics(m, i, e, avail: W - 8 - indw - gap, horizontal: false, compact: false, measure: measure)
                let ih = Swift.max(indw, tm?.h ?? 0), iw = 8 + indw + (tm.map { gap + $0.w } ?? 0)
                let inner = AWCStepperRect(x: 0, y: y, width: iw, height: ih)
                let indR = AWCStepperRect(x: 8, y: y + awcStepperHalf(ih - indw), width: indw, height: indw)
                var sp = parts(m, i, e, v, inner: inner, ind: indR, ih: ind, textX: 8 + indw + gap, textY: y + (tm.map { awcStepperHalf(ih - $0.h) } ?? 0), tm: tm, horizontal: false)
                let pb = m.isLast(i) ? 0 : e.sp("inset-lg", 16)
                let ms = 8 + ind.h + 2 * ind.ring + gap
                let panelH = m.renderPanel(i) ? awcStepperLU(panelInner(i, false) * v.panel) : 0
                let hostH = ih + panelH + pb
                sp.hasLeadingConnector = i > 0
                if !m.isLast(i) {
                    let th = e.hooks.px("connector-thickness") ?? Swift.max(2, 4 + 0.5 * e.s)
                    let top = ind.ring + ind.h + 6, bottom = 6 - ind.ring
                    sp.connector = (AWCStepperRect(x: 8 + ind.ring + (ind.h - th) / 2, y: y + top, width: th, height: hostH - top - bottom), v.connector, v.fill, v.filled, true)
                }
                if m.renderPanel(i) {
                    let cr = AWCStepperRect(x: ms, y: y + ih, width: W - ms, height: panelH)
                    sp.panel = (cr, v.panelOpacity, v.panelVisible, m.p.lazy ? nil : panelH, (ms, cr.y + e.sp("inset-xs", 4)), W - ms)
                    if m.navActions(i) {
                        sp.actions = AWCStepperRect(x: ms, y: cr.y + e.sp("inset-xs", 4) + contentH(i) + e.sp("gap-lg", 16), width: W - ms, height: buttonHeight(e.s))
                    }
                }
                sp.hostRect = AWCStepperRect(x: 0, y: y, width: W, height: hostH)
                steps.append(sp)
                y += hostH + (i < n - 1 ? input.hooks.stepperGap : 0)
            }
            listH = y
        }
        var hostOff = 0.0
        out.list = hideList ? nil : AWCStepperRect(x: 0, y: 0, width: W, height: listH)
        var cy = hideList ? 0 : listH
        if let slot = input.slotHeight {
            let mg = senv.sp("inset-xl", 24)
            if hideList { hostOff = mg; out.content = AWCStepperRect(x: 0, y: 0, width: W, height: slot) }   // the margin collapses through the host
            else { out.content = AWCStepperRect(x: 0, y: cy + mg, width: W, height: slot) }
            cy = out.content.y + slot
        } else { out.content = AWCStepperRect(x: 0, y: cy, width: W, height: 0) }
        let bh = buttonHeight(sd)
        let backW = input.buttonWidths?.back ?? buttonWidth(p.backLabel, sd, measure: measure)
        let nextW = input.buttonWidths?.next ?? buttonWidth(m.isFinishStep ? p.finishLabel : p.nextLabel, sd, measure: measure)
        if p.nav && !mobile && horizontal && n > 0 {
            let ny = cy + Swift.max(4, 20 + 2 * sd)
            out.nav = AWCStepperRect(x: 0, y: ny, width: W, height: bh)
            let g = senv.sp("gap-sm", 8)
            out.navButtons = (AWCStepperRect(x: W - nextW - g - backW, y: ny, width: backW, height: bh), AWCStepperRect(x: W - nextW, y: ny, width: nextW, height: bh))
            cy = ny + bh
        }
        if p.nav && mobile && n > 0 {
            let my = cy + senv.sp("gap-lg", 16), g = senv.sp("gap-sm", 8)
            out.mobileNav = AWCStepperRect(x: 0, y: my, width: W, height: bh)
            let ph: Double = p.indicator == "dot" ? 8 : 20
            let prog = AWCStepperRect(x: backW + g, y: my + awcStepperHalf(bh - ph), width: W - backW - nextW - 2 * g, height: ph)
            out.mobileProgress = prog
            out.navButtons = (AWCStepperRect(x: 0, y: my, width: backW, height: bh), AWCStepperRect(x: W - nextW, y: my, width: nextW, height: bh))
            if p.indicator == "dot" {
                let total = Double(n) * 8 + Double(Swift.max(0, n - 1)) * g
                var x = prog.x + awcStepperHalf(prog.width - total)
                for i in 0..<n {
                    let activeDot = i == m.active, done = i < m.active || m.steps[i].completed
                    let color = activeDot || done ? (input.hooks.step("active-color").flatMap(awcStepperColor) ?? theme.color("primary", "#6750A4"))
                                                  : (input.hooks.step("connector-color").flatMap(awcStepperColor) ?? theme.color("outline", "#79747E"))
                    var c: [Double] = [color.r, color.g, color.b, color.a], sc = activeDot && !reduced ? 1.5 : 1
                    if let motion { c = motion.animate("dot\(i).bg", c, now: now, duration: reduced ? 0.01 : 200, ease: AWCStepperEasing.effects)
                                    sc = motion.animate("dot\(i).scale", [sc], now: now, duration: reduced ? 0.01 : 500, ease: AWCStepperEasing.spatial)[0] }
                    out.mobileDots.append((AWCStepperRect(x: x, y: prog.y, width: 8, height: 8), (c[0], c[1], c[2], c[3]), sc))
                    x += 8 + g
                }
            } else {
                let t = "\(p.stepWord) \(m.active + 1) \(p.ofWord) \(n)"
                let tw = awcStepperLUCeil(measure(t, 14, 500, 0))
                out.mobileText = (AWCStepperRect(x: prog.x + awcStepperHalf(prog.width - tw), y: prog.y, width: tw, height: 20), t, theme.color("on-surface-variant", "#49454F"))
            }
            cy = my + bh
        }
        out.host = AWCStepperRect(x: 0, y: hostOff, width: W, height: cy)
        // RTL mirrors every box about the host; the mobile-slot margin moves the host's contents down.
        func fix(_ r: AWCStepperRect) -> AWCStepperRect { r.isEmpty ? r : (input.rtl ? r.mirrored(W) : r).offset(0, hostOff) }
        out.list = out.list.map(fix); out.content = fix(out.content); out.nav = out.nav.map(fix); out.mobileNav = out.mobileNav.map(fix); out.mobileProgress = out.mobileProgress.map(fix)
        if let b = out.navButtons { out.navButtons = (fix(b.back), fix(b.next)) }
        out.mobileDots = out.mobileDots.map { (fix($0.rect), $0.color, $0.scale) }
        if let t = out.mobileText { out.mobileText = (fix(t.rect), t.text, t.color) }
        out.steps = steps.map { s in
            var s = s
            s.hostRect = fix(s.hostRect); s.inner = fix(s.inner); s.indicator = fix(s.indicator); s.stateLayer = fix(s.stateLayer); s.bubble = fix(s.bubble)
            s.text = s.text.map(fix); s.lines = s.lines.map { var l = $0; l.rect = fix(l.rect); return l }
            if let c = s.connector { s.connector = (fix(c.rect), c.color, c.fill, c.fillColor, c.vertical) }
            if let pn = s.panel {
                let r = fix(pn.rect)
                let ox = input.rtl ? W - pn.contentOrigin.x - pn.contentWidth : pn.contentOrigin.x
                s.panel = (r, pn.opacity, pn.visible, pn.gridRows, (ox, pn.contentOrigin.y + hostOff), pn.contentWidth)
            }
            s.actions = s.actions.map(fix)
            return s
        }
        return out
    }
}
