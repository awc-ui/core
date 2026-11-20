import SwiftUI
import Observation
#if canImport(AppKit)
import AppKit
#endif
#if canImport(UIKit)
import UIKit
#endif

// MARK: - Hooks

/// The six public md-ripple hooks (`--md-ripple-*`), kept as the CSS value text the source reads so that every fallback
/// matches it: `opacity` follows JavaScript `Number()` (empty/invalid → 0.12, finite values clamped to 0…1), the two extents
/// accept only concrete non-negative pixel values (`12`, `12px`; percentages, `calc()` and negatives → 0), `growDuration`
/// accepts `ms`, `s` and unitless milliseconds (invalid → 450 ms), and an easing the browser would reject falls back to the
/// standard curve. `color` replaces the inherited content colour (`currentColor`) and keeps its alpha.
/// Values set closer to the ripple win over inherited ones, including invalid values (they then fall back to the default,
/// exactly like an invalid per-instance custom property).
public struct AWCRippleAppearance: Equatable, Sendable {
    /// Hook text by suffix (`color`, `opacity`, `extend-inline`, `extend-block`, `grow-duration`, `grow-easing`).
    public let css: [String: String]
    var color: String? { css["color"] }
    var opacity: String? { css["opacity"] }
    var extendInline: String? { css["extend-inline"] }
    var extendBlock: String? { css["extend-block"] }
    var growDuration: String? { css["grow-duration"] }
    var growEasing: String? { css["grow-easing"] }
    /// Typed hooks: colour `#RRGGBB`/`#RRGGBBAA`, opacity, extents in points, grow duration in milliseconds, CSS easing text.
    public init(color: String? = nil, opacity: Double? = nil, extendInline: Double? = nil, extendBlock: Double? = nil, growDuration: Double? = nil, growEasing: String? = nil) {
        func n(_ v: Double) -> String { !v.isFinite ? "invalid" : v == v.rounded() && abs(v) < 1e15 ? String(Int64(v)) : String(v) }
        var c: [String: String] = [:]
        if let color { c["color"] = color }; if let opacity { c["opacity"] = n(opacity) }
        if let extendInline { c["extend-inline"] = extendInline.isFinite ? n(extendInline) + "px" : "invalid" }
        if let extendBlock { c["extend-block"] = extendBlock.isFinite ? n(extendBlock) + "px" : "invalid" }
        if let growDuration { c["grow-duration"] = growDuration.isFinite ? n(growDuration) + "ms" : "invalid" }
        if let growEasing { c["grow-easing"] = growEasing }
        css = c
    }
    /// Raw custom-property text, exactly as the source reads it (invalid text falls back like the source).
    public init(cssValues: [String: String]) {
        css = cssValues.filter { ["color", "opacity", "extend-inline", "extend-block", "grow-duration", "grow-easing"].contains($0.key) }
    }
    /// Laboratory/source names: `color`, `opacity`, `extendInline`, `extendBlock`, `growDuration` (ms), `growEasing`.
    public init(values: [String: AWCValue]) {
        self.init(color: values["color"]?.string, opacity: values["opacity"]?.number, extendInline: values["extendInline"]?.number,
                  extendBlock: values["extendBlock"]?.number, growDuration: values["growDuration"]?.number, growEasing: values["growEasing"]?.string)
    }
    public func merging(_ o: Self) -> Self { .init(cssValues: css.merging(o.css) { _, new in new }) }
    static let defaultOpacity = 0.12, defaultGrow = 450.0, fade = 150.0
    /// `Number(raw)`: trimmed decimal/exponent or 0x/0o/0b integer; empty → default; non-finite → default; clamp 0…1.
    var resolvedOpacity: Double {
        guard let raw = opacity?.trimmingCharacters(in: .whitespacesAndNewlines), !raw.isEmpty, let v = AWCRippleAppearance.jsNumber(raw), v.isFinite else { return Self.defaultOpacity }
        return min(1, max(0, v))
    }
    static func jsNumber(_ s: String) -> Double? {
        let l = s.lowercased()
        for (prefix, radix) in [("0x", 16), ("0o", 8), ("0b", 2)] where l.hasPrefix(prefix) { return Int(l.dropFirst(2), radix: radix).map(Double.init) }
        if l == "infinity" || l == "+infinity" || l == "-infinity" { return .infinity }
        guard l.range(of: "^[+-]?(\\d+\\.?\\d*|\\.\\d+)(e[+-]?\\d+)?$", options: .regularExpression) != nil else { return nil }
        return Double(l)
    }
    static func extent(_ raw: String?) -> Double {
        guard let raw = raw?.trimmingCharacters(in: .whitespacesAndNewlines), !raw.isEmpty,
              raw.range(of: "^(\\d+\\.?\\d*|\\.\\d+)(px)?$", options: [.regularExpression, .caseInsensitive]) != nil else { return 0 }
        let v = Double(raw.lowercased().replacingOccurrences(of: "px", with: "")) ?? 0
        return v.isFinite && v > 0 ? v : 0
    }
    var resolvedExtendInline: Double { Self.extent(extendInline) }
    var resolvedExtendBlock: Double { Self.extent(extendBlock) }
    var resolvedGrowDuration: Double {
        guard let raw = growDuration?.trimmingCharacters(in: .whitespacesAndNewlines), !raw.isEmpty,
              let m = raw.range(of: "^(\\d+\\.?\\d*|\\.\\d+)(ms|s)?$", options: [.regularExpression, .caseInsensitive]) else { return Self.defaultGrow }
        let t = raw[m].lowercased()
        if t.hasSuffix("ms") { return Double(t.dropLast(2)) ?? Self.defaultGrow }
        if t.hasSuffix("s") { return (Double(t.dropLast()) ?? Self.defaultGrow / 1000) * 1000 }
        return Double(t) ?? Self.defaultGrow
    }
    var resolvedGrowEasing: AWCRippleEasing {
        guard let raw = growEasing?.trimmingCharacters(in: .whitespacesAndNewlines), !raw.isEmpty else { return .standard }
        return AWCRippleEasing(css: raw) ?? .standard
    }
}

/// A CSS `<easing-function>` (keywords, `cubic-bezier()`, `steps()`, `linear()`), evaluated like Web Animations.
public struct AWCRippleEasing: Equatable, Sendable {
    enum Kind: Equatable, Sendable { case bezier(Double, Double, Double, Double), steps(Int, String), points([(Double, Double)]) 
        static func == (a: Kind, b: Kind) -> Bool { switch (a, b) { case let (.bezier(a1, a2, a3, a4), .bezier(b1, b2, b3, b4)): return [a1, a2, a3, a4] == [b1, b2, b3, b4]
            case let (.steps(a1, a2), .steps(b1, b2)): return a1 == b1 && a2 == b2
            case let (.points(a), .points(b)): return a.count == b.count && zip(a, b).allSatisfy { $0.0 == $1.0 && $0.1 == $1.1 }
            default: return false } } }
    let kind: Kind
    public let css: String
    public static let standard = AWCRippleEasing(kind: .bezier(0.2, 0, 0, 1), css: "cubic-bezier(0.2, 0, 0, 1)")
    public static let linear = AWCRippleEasing(kind: .points([(0, 0), (1, 1)]), css: "linear")
    public static func cubicBezier(_ x1: Double, _ y1: Double, _ x2: Double, _ y2: Double) -> AWCRippleEasing? { AWCRippleEasing(css: "cubic-bezier(\(x1), \(y1), \(x2), \(y2))") }
    init(kind: Kind, css: String) { self.kind = kind; self.css = css }
    /// nil when Chrome would reject the value (the source then falls back to the standard curve).
    public init?(css raw: String) {
        let s = raw.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let keywords: [String: Kind] = ["ease": .bezier(0.25, 0.1, 0.25, 1), "ease-in": .bezier(0.42, 0, 1, 1), "ease-out": .bezier(0, 0, 0.58, 1),
                                        "ease-in-out": .bezier(0.42, 0, 0.58, 1), "linear": .points([(0, 0), (1, 1)]), "step-start": .steps(1, "jump-start"), "step-end": .steps(1, "jump-end")]
        if let k = keywords[s] { self.init(kind: k, css: raw); return }
        func args(_ name: String) -> [String]? {
            guard s.hasPrefix(name + "("), s.hasSuffix(")") else { return nil }
            return s.dropFirst(name.count + 1).dropLast().split(separator: ",", omittingEmptySubsequences: false).map { $0.trimmingCharacters(in: .whitespaces) }
        }
        func number(_ t: String) -> Double? { t.range(of: "^[+-]?(\\d+\\.?\\d*|\\.\\d+)(e[+-]?\\d+)?$", options: .regularExpression) != nil ? Double(t) : nil }
        if let a = args("cubic-bezier") {
            guard a.count == 4, let x1 = number(a[0]), let y1 = number(a[1]), let x2 = number(a[2]), let y2 = number(a[3]), (0...1).contains(x1), (0...1).contains(x2) else { return nil }
            self.init(kind: .bezier(x1, y1, x2, y2), css: raw); return
        }
        if let a = args("steps") {
            guard (1...2).contains(a.count), let n = Int(a[0]) else { return nil }
            let pos = a.count == 2 ? a[1] : "end"
            let canon = ["start": "jump-start", "end": "jump-end", "jump-start": "jump-start", "jump-end": "jump-end", "jump-none": "jump-none", "jump-both": "jump-both"]
            guard let p = canon[pos], n >= (p == "jump-none" ? 2 : 1) else { return nil }
            self.init(kind: .steps(n, p), css: raw); return
        }
        if let a = args("linear") {
            // linear(<number> [<percentage>{1,2}]?, …): at least two stops; missing positions are spread evenly.
            var stops: [(Double, Double?)] = []
            for part in a {
                let tokens = part.split(separator: " ").map(String.init).filter { !$0.isEmpty }
                guard let first = tokens.first, let y = number(first), tokens.count <= 3 else { return nil }
                var positions: [Double] = []
                for t in tokens.dropFirst() { guard t.hasSuffix("%"), let p = number(String(t.dropLast())) else { return nil }; positions.append(p / 100) }
                if positions.isEmpty { stops.append((y, nil)) } else { for p in positions { stops.append((y, p)) } }
            }
            guard stops.count >= 2 else { return nil }
            var xs = stops.map { $0.1 }
            if xs[0] == nil { xs[0] = 0 }; if xs[xs.count - 1] == nil { xs[xs.count - 1] = max(1, xs.compactMap { $0 }.max() ?? 1) }
            var last = xs[0]!
            for i in 1..<xs.count { if let v = xs[i] { xs[i] = max(v, last); last = xs[i]! } }
            var i = 0
            while i < xs.count { if xs[i] == nil { var j = i; while xs[j] == nil { j += 1 }; let a0 = xs[i - 1]!, b0 = xs[j]!
                    for k in i..<j { xs[k] = a0 + (b0 - a0) * Double(k - i + 1) / Double(j - i + 1) }; i = j } else { i += 1 } }
            self.init(kind: .points(zip(xs.map { $0! }, stops.map { $0.0 }).map { ($0, $1) }), css: raw); return
        }
        return nil
    }
    /// Output progress for input progress `p` (0…1, before-phase handled by the caller).
    public func callAsFunction(_ p: Double) -> Double {
        switch kind {
        case let .bezier(x1, y1, x2, y2): return AWCNativeButtonTiming.cubic(p, x1: x1, y1: y1, x2: x2, y2: y2)
        case let .steps(n, pos):
            let jumps = Double(n), current0 = (p * jumps).rounded(.down)
            var current = pos == "jump-start" || pos == "jump-both" ? current0 + 1 : current0
            if p >= 1 { current = pos == "jump-end" ? jumps : (pos == "jump-none" ? jumps - 1 : (pos == "jump-both" ? jumps + 1 : jumps)) }
            let total = pos == "jump-none" ? jumps - 1 : (pos == "jump-both" ? jumps + 1 : jumps)
            return min(1, max(0, current / total))
        case .points(let pts):
            if p <= pts[0].0 { return pts[0].1 }
            for k in 1..<pts.count where p <= pts[k].0 || k == pts.count - 1 {
                let (x0, y0) = pts[k - 1], (x1, y1) = pts[k]
                if x1 == x0 { return y1 }
                return y0 + (y1 - y0) * (p - x0) / (x1 - x0)
            }
            return pts[pts.count - 1].1
        }
    }
}

private struct AWCRippleAppearanceKey: EnvironmentKey { static let defaultValue = AWCRippleAppearance() }
private struct AWCRippleEnabledKey: EnvironmentKey { static let defaultValue = true }
private struct AWCRippleControllerKey: EnvironmentKey { static let defaultValue: AWCRippleController? = nil }
private struct AWCRippleHostRadiusKey: EnvironmentKey { static let defaultValue: CGFloat = 0 }
private struct AWCRippleContentColorKey: EnvironmentKey { static let defaultValue: Color? = nil }
private struct AWCRippleTestTimeKey: EnvironmentKey { static let defaultValue: AWCRippleTestTime? = nil }
/// A frozen render time for paint fixtures (the Web reference pauses its Web Animations at the same instants).
enum AWCRippleTestTime: Equatable { case grow(Double), held, fade(Double) }
public extension EnvironmentValues {
    var awcRippleAppearance: AWCRippleAppearance { get { self[AWCRippleAppearanceKey.self] } set { self[AWCRippleAppearanceKey.self] = newValue } }
    /// The native `--md-sys-ripple-enabled`: false suppresses new waves and hides a running one.
    var awcRippleEnabled: Bool { get { self[AWCRippleEnabledKey.self] } set { self[AWCRippleEnabledKey.self] = newValue } }
    var awcRippleController: AWCRippleController? { get { self[AWCRippleControllerKey.self] } set { self[AWCRippleControllerKey.self] = newValue } }
    /// The host surface's corner radius an `md-ripple` node inherits for its clip (`border-radius: inherit`).
    var awcRippleHostCornerRadius: CGFloat { get { self[AWCRippleHostRadiusKey.self] } set { self[AWCRippleHostRadiusKey.self] = newValue } }
    /// The inherited content colour (`currentColor`) an `md-ripple` node paints when no colour hook is set.
    var awcRippleContentColor: Color? { get { self[AWCRippleContentColorKey.self] } set { self[AWCRippleContentColorKey.self] = newValue } }
}
extension EnvironmentValues {
    var awcRippleTestTime: AWCRippleTestTime? { get { self[AWCRippleTestTimeKey.self] } set { self[AWCRippleTestTimeKey.self] = newValue } }
}
private struct AWCRippleAppearanceModifier: ViewModifier {
    let value: AWCRippleAppearance
    @Environment(\.awcRippleAppearance) private var inherited
    func body(content: Content) -> some View { content.environment(\.awcRippleAppearance, inherited.merging(value)) }
}
public extension View {
    /// Applies md-ripple hook values to descendant ripples (inherited like the custom properties; nearer values win).
    func awcRippleAppearance(_ value: AWCRippleAppearance) -> some View { modifier(AWCRippleAppearanceModifier(value: value)) }
    /// Binds `trigger()` / `whenSettled()` to the ripples below.
    func awcRippleController(_ controller: AWCRippleController) -> some View { environment(\.awcRippleController, controller) }
}

// MARK: - Controller and engine

/// md-ripple's public methods. `trigger()` starts a centred, self-releasing wave unless disabled or suppressed;
/// `whenSettled()` waits for the current cycle with the source's bound (150 + 50 ms): it can return while a held or
/// long-growing wave is still visible, and never settles a later wave.
@MainActor @Observable public final class AWCRippleController {
    @ObservationIgnored weak var engine: AWCRippleEngine?
    nonisolated public init() {}
    public func trigger() { engine?.trigger() }
    public func whenSettled() async { await engine?.whenSettled() }
}

/// Parity tests' clock for md-ripple waves (ms): a replay of a Web timeline stamps and renders waves on it; unset = the display's time.
@MainActor @Observable final class AWCRippleTestClock {
    var now: Double
    init(now: Double) { self.now = now }
}

@MainActor @Observable final class AWCRippleEngine {
    struct Cycle: Equatable { let id: Int; let origin: CGPoint; let radius: Double; let opacity: Double; let grow: Double; let easing: AWCRippleEasing
        let start: Double; var release: Double?; static func == (a: Cycle, b: Cycle) -> Bool { a.id == b.id && a.release == b.release } }
    private(set) var cycle: Cycle?
    @ObservationIgnored private var nextID = 0
    @ObservationIgnored private var waiters: [Int: [() -> Void]] = [:]
    @ObservationIgnored private var ending: Task<Void, Never>?
    @ObservationIgnored var size: CGSize = .zero
    @ObservationIgnored var appearance = AWCRippleAppearance()
    @ObservationIgnored var disabled = false
    @ObservationIgnored var suppressed = false
    @ObservationIgnored var connected = false
    /// Paint fixtures freeze the render time; the wave then stays until replaced or removed.
    @ObservationIgnored var frozen = false
    /// Parity tests only (AWCRippleTestClock); nil in apps.
    static var testClock: AWCRippleTestClock?
    static func now() -> Double { testClock?.now ?? CACurrentMediaTime() * 1000 }
    /// Wave geometry of the source: farthest corner of the host rectangle expanded by the two extents.
    func radius(at p: CGPoint) -> Double {
        let ei: Double = appearance.resolvedExtendInline, eb: Double = appearance.resolvedExtendBlock
        let x = Double(p.x), y = Double(p.y), w = Double(size.width), h = Double(size.height)
        let dx: Double = Swift.max(Swift.abs(x + ei), Swift.abs(x - (w + ei)))
        let dy: Double = Swift.max(Swift.abs(y + eb), Swift.abs(y - (h + eb)))
        return (dx * dx + dy * dy).squareRoot()
    }
    @discardableResult func press(at p: CGPoint) -> Bool {
        guard connected, !disabled, !suppressed else { return false }
        finish(); nextID += 1
        cycle = .init(id: nextID, origin: p, radius: radius(at: p), opacity: appearance.resolvedOpacity, grow: appearance.resolvedGrowDuration,
                      easing: appearance.resolvedGrowEasing, start: Self.now(), release: nil)
        return true
    }
    func release() {
        guard var c = cycle, c.release == nil else { return }
        c.release = Self.now(); cycle = c
        if frozen { return }
        let end = max(c.start + c.grow, c.release!) + AWCRippleAppearance.fade, id = c.id
        ending?.cancel()
        ending = Task { @MainActor [weak self] in
            // Re-checked after the sleep: a test clock can run behind the display's.
            while !Task.isCancelled, case let wait = end - Self.now(), wait > 0 { try? await Task.sleep(nanoseconds: UInt64(wait * 1_000_000)) }
            guard !Task.isCancelled, let self, self.cycle?.id == id else { return }
            self.finish()
        }
    }
    func trigger() {
        guard connected, !disabled, !suppressed else { return }
        if press(at: CGPoint(x: size.width / 2, y: size.height / 2)) { release() }
    }
    /// Cancels and removes the current wave and settles only its waiters.
    func finish() {
        ending?.cancel(); ending = nil
        guard let c = cycle else { return }
        cycle = nil
        for w in waiters.removeValue(forKey: c.id) ?? [] { w() }
    }
    func whenSettled() async {
        guard let id = cycle?.id else { return }
        await withCheckedContinuation { (k: CheckedContinuation<Void, Never>) in
            let once = AWCRippleOnce { k.resume() }
            waiters[id, default: []].append { once.fire() }
            Task { @MainActor in try? await Task.sleep(nanoseconds: UInt64((AWCRippleAppearance.fade + 50) * 1_000_000)); once.fire() }
        }
    }
    /// Whether a point lies inside the rounded host rectangle (presses outside its corners miss the host, as in Chrome).
    nonisolated static func inside(_ p: CGPoint, _ size: CGSize, _ radius: CGFloat) -> Bool {
        let w = Double(size.width), h = Double(size.height), x = Double(p.x), y = Double(p.y)
        guard x >= 0, y >= 0, x <= w, y <= h else { return false }
        let r = Swift.min(Double(radius), w / 2, h / 2)
        guard r > 0 else { return true }
        let cx = x < r ? r : (x > w - r ? w - r : x), cy = y < r ? r : (y > h - r ? h - r : y)
        let dx = x - cx, dy = y - cy
        return dx * dx + dy * dy <= r * r
    }
    /// Scale and opacity of a cycle at time `t` (ms), or nil once it has ended.
    static func sample(_ c: Cycle, at t: Double) -> (scale: Double, opacity: Double)? {
        let g: Double = Swift.min(1, Swift.max(0, (t - c.start) / Swift.max(c.grow, 1e-9)))
        let scale: Double = c.grow <= 0 || t - c.start >= c.grow ? 1 : c.easing(g)
        guard let r = c.release else { return (scale, c.opacity) }
        let fadeStart = max(c.start + c.grow, r)
        if t < fadeStart { return (scale, c.opacity) }
        let f = (t - fadeStart) / AWCRippleAppearance.fade
        if f >= 1 { return nil }
        return (scale, c.opacity * (1 - AWCNativeButtonTiming.cubic(f, x1: 0.2, y1: 0, x2: 0, y2: 1)))
    }
}
/// Runs its action once, from either the cycle's settlement or the bound timer.
@MainActor final class AWCRippleOnce {
    private var action: (() -> Void)?
    init(_ action: @escaping () -> Void) { self.action = action }
    func fire() { action?(); action = nil }
}

// MARK: - Surface decorator

/// The wave layer: an overlay that fills and clips the host surface, never hit-testable.
struct AWCRippleWaveLayer: View {
    let engine: AWCRippleEngine
    let color: Color, cornerRadius: CGFloat, enabled: Bool, hidden: Bool
    let testTime: AWCRippleTestTime?
    let inspectNodeID: String?
    func time(_ c: AWCRippleEngine.Cycle) -> Double {
        switch testTime {
        case .grow(let ms)?: return c.start + ms
        case .held?: return c.start + max(0, c.grow)
        case .fade(let ms)?: return max(c.start + c.grow, c.release ?? c.start + c.grow) + ms
        case nil: return AWCRippleEngine.now()
        }
    }
    var body: some View {
        let cycle = engine.cycle
        let _ = AWCRippleEngine.testClock?.now   // a test clock's tick re-renders the wave (no display-link frames offscreen)
        TimelineView(.animation(minimumInterval: nil, paused: cycle == nil || testTime != nil)) { _ in
            let t = cycle.map(time) ?? AWCRippleEngine.now()
            let s = cycle.flatMap { AWCRippleEngine.sample($0, at: t) }
            let wave = ZStack(alignment: .topLeading) {
                if let c = cycle, let s, !hidden {
                    Circle().fill(color).opacity(s.opacity)
                        .frame(width: 2 * c.radius, height: 2 * c.radius)
                        .scaleEffect(s.scale)
                        .position(c.origin)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .environment(\.layoutDirection, .leftToRight)   // the origin is physical (it never mirrors in RTL)
            .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .circular))
            .opacity(enabled ? 1 : 0)
            if let id = inspectNodeID {
                wave.awcInspect(nodeID: id, name: "md-ripple") { _ in
                    var m: [String: AWCValue] = ["renderTime": .number(AWCRippleEngine.now()), "cornerRadius": .number(Double(cornerRadius)), "containerOpacity": .number(enabled ? 1 : 0),
                                                 "waves": .number(cycle != nil && s != nil ? 1 : 0), "hidden": .bool(hidden)]
                    if let c = cycle, let s { m["waveX"] = .number(c.origin.x); m["waveY"] = .number(c.origin.y); m["waveDiameter"] = .number(2 * c.radius)
                        m["waveScale"] = .number(s.scale); m["waveOpacity"] = .number(s.opacity); m["waveSince"] = .number(t - c.start) }
                    return m
                }
            } else { wave }
        }
    }
}

/// The md-ripple composition: the host surface's own gestures keep working (the press is observed simultaneously);
/// the wave originates at the physical press point, reaches the farthest corner of the host rectangle grown by the
/// extents, grows with the hook duration/easing at constant opacity, and fades 150 ms with the standard curve once both
/// the press is released and the growth is complete. A new press replaces the old wave; disabling, losing the window or
/// scene, and disappearing remove the wave immediately.
struct AWCRippleSurface: ViewModifier {
    let disabled: Bool, hidden: Bool, cornerRadius: CGFloat, contentColor: Color?, controller: AWCRippleController?, local: AWCRippleAppearance?
    var inspectNodeID: String? = nil
    @Environment(\.awcRippleAppearance) private var inherited
    @Environment(\.awcRippleEnabled) private var enabledEnvironment
    @Environment(\.awcRippleContentColor) private var inheritedContentColor
    @Environment(\.awcThemeTokens) private var tokens
    @Environment(\.awcTheme) private var theme
    @Environment(\.awcRippleTestTime) private var testTime
    #if os(macOS)
    @Environment(\.controlActiveState) private var activeState
    #else
    @Environment(\.scenePhase) private var scenePhase
    #endif
    @State private var engine = AWCRippleEngine()
    @State private var tracking = false
    @GestureState private var pressing = false
    var enabled: Bool { enabledEnvironment && tokens["--md-sys-ripple-enabled"]?.trimmingCharacters(in: .whitespaces) != "0" }
    func color(_ a: AWCRippleAppearance) -> Color {
        if let raw = a.color?.trimmingCharacters(in: .whitespaces), !raw.isEmpty { return awcSwitchColor(raw).map { Color(awcHex: $0) } ?? .clear }
        return contentColor ?? inheritedContentColor ?? theme?.onSurface ?? Color(awcHex: "#1C1B1F")
    }
    func sync(_ a: AWCRippleAppearance) { engine.disabled = disabled; engine.suppressed = !enabled; engine.appearance = a; engine.frozen = testTime != nil; controller?.engine = engine }
    func body(content: Content) -> some View {
        let appearance = local.map { inherited.merging($0) } ?? inherited
        content
            .overlay { AWCRippleWaveLayer(engine: engine, color: color(appearance), cornerRadius: cornerRadius, enabled: enabled, hidden: hidden, testTime: testTime, inspectNodeID: inspectNodeID).allowsHitTesting(false) }
            .onGeometryChange(for: CGSize.self) { $0.size } action: { engine.size = $0 }
            .simultaneousGesture(DragGesture(minimumDistance: 0, coordinateSpace: .local)
                .updating($pressing) { _, state, _ in state = true }
                .onChanged { value in
                    guard !tracking, AWCRippleEngine.inside(value.startLocation, engine.size, cornerRadius) else { return }
                    tracking = true; sync(appearance); if !engine.press(at: value.startLocation) { tracking = false } }
                .onEnded { _ in if tracking { tracking = false; engine.release() } })
            .onChange(of: pressing) { _, now in if !now && tracking { tracking = false; engine.release() } }
            .onAppear { engine.connected = true; sync(appearance) }
            .onDisappear { engine.connected = false; tracking = false; engine.finish() }
            .onChange(of: disabled) { _, d in sync(appearance); if d { tracking = false; engine.finish() } }
            .onChange(of: enabled) { _, _ in sync(appearance) }
            .onChange(of: testTime) { _, _ in sync(appearance) }
            .onChange(of: appearance) { _, a in sync(a) }
            .onChange(of: controller.map(ObjectIdentifier.init)) { _, _ in sync(appearance) }
            #if os(macOS)
            .onChange(of: activeState) { old, s in if old == .key && s != .key { tracking = false; engine.finish() } }
            #else
            .onChange(of: scenePhase) { _, s in if s != .active { tracking = false; engine.finish() } }
            #endif
    }
}

public extension View {
    /// Decorates this surface with an md-ripple: pass the surface's corner radius (the clip inherits it), its content
    /// colour (`currentColor`), an optional controller for `trigger()`/`whenSettled()` and per-instance hooks.
    func awcRipple(disabled: Bool = false, cornerRadius: CGFloat = 0, contentColor: Color? = nil, controller: AWCRippleController? = nil, appearance: AWCRippleAppearance? = nil) -> some View {
        modifier(AWCRippleSurface(disabled: disabled, hidden: false, cornerRadius: cornerRadius, contentColor: contentColor, controller: controller, local: appearance))
    }
}

/// An `md-ripple` node: it fills the area its parent gives it, clips to the inherited host radius and paints the
/// inherited content colour; `disabled` and `hidden` follow the source. Bind methods with `awcRippleController(_:)`.
struct AWCNativeRippleNode: View {
    let node: AWCNode
    @Environment(\.awcRippleController) private var controller
    @Environment(\.awcRippleHostCornerRadius) private var radius
    var body: some View {
        Color.clear.contentShape(Rectangle())
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .modifier(AWCRippleSurface(disabled: node.properties["disabled"]?.bool == true, hidden: node.properties["hidden"]?.bool == true,
                                       cornerRadius: radius, contentColor: nil, controller: controller, local: nil, inspectNodeID: node.id))
            .accessibilityHidden(true)
    }
}

/// The Laboratory's md-ripple example: a token-styled button surface ("Tap to see the ripple": label-large text,
/// 16 × 24 padding, 16 radius, on-surface on surface-container-highest) decorated with the md-ripple node — its
/// `disabled`/`hidden` properties, inspection and the bound controller. The Web recipe renders the same button.
public struct AWCRippleExampleSurface: View {
    let node: AWCNode, label: String
    public init(node: AWCNode, label: String = "Tap to see the ripple") { self.node = node; self.label = label }
    @Environment(\.awcThemeTokens) private var tokens
    @Environment(\.awcRippleController) private var controller
    @State private var focusHandle = AWCButtonFocusHandle()
    /// The recipe's button: one native button element and keyboard stop (the Web <button> has no action; keyboard
    /// activation starts no wave, as md-ripple listens to pointer presses only).
    private var focusConfiguration: AWCNativeFocusConfiguration {
        .init(id: node.id + "-surface", label: label, policy: AWCButtonAccessibilityPolicy(properties: [:]), group: nil, cell: nil,
              handle: focusHandle, focusChanged: { _ in }, activate: {})
    }
    public var body: some View {
        let ink = Color(awcHex: tokens["--md-sys-color-on-surface"] ?? "#1C1B1F")
        let fill = Color(awcHex: tokens["--md-sys-color-surface-container-highest"] ?? "#E6E0E9")
        Text(label).font(AWCNativeFonts.label(size: 14, weight: 500)).tracking(0.1).foregroundStyle(ink)
            .frame(minHeight: 20).padding(.vertical, 16).padding(.horizontal, 24)
            .background(RoundedRectangle(cornerRadius: 16, style: .circular).fill(fill))
            .contentShape(RoundedRectangle(cornerRadius: 16, style: .circular))
            .accessibilityHidden(true)
            .awcFocusBridgeLayer { AWCNativeButtonFocusBridge(configuration: focusConfiguration) }
        .modifier(AWCRippleSurface(disabled: node.properties["disabled"]?.bool == true, hidden: node.properties["hidden"]?.bool == true,
                                   cornerRadius: 16, contentColor: ink, controller: controller, local: nil, inspectNodeID: node.id))
    }
}
