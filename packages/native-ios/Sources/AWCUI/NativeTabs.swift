import SwiftUI
import Observation
import CoreText
#if canImport(AppKit)
import AppKit
#endif

// MARK: - Hooks

/// md-tab's nine public hooks (`--md-tab-*`). Colours are `#RRGGBB(AA)`; the indicator height is in points; the glide
/// duration (the indicator transform transition, 400 ms by default) in milliseconds. `--md-tab-glide-x` / `-scale` are
/// not hooks: md-tabs writes them inline for every glide. Unset hooks keep the source defaults; nearer values win.
public struct AWCTabAppearance: Equatable, Sendable {
    public let containerColor: String?, activeLabelColor: String?, inactiveLabelColor: String?, activeIconColor: String?
    public let inactiveIconColor: String?, activeIndicatorColor: String?, activeIndicatorHeight: Double?, dividerColor: String?, glideDuration: Double?
    public init(containerColor: String? = nil, activeLabelColor: String? = nil, inactiveLabelColor: String? = nil, activeIconColor: String? = nil,
                inactiveIconColor: String? = nil, activeIndicatorColor: String? = nil, activeIndicatorHeight: Double? = nil, dividerColor: String? = nil,
                glideDuration: Double? = nil) {
        self.containerColor = awcSwitchColor(containerColor); self.activeLabelColor = awcSwitchColor(activeLabelColor)
        self.inactiveLabelColor = awcSwitchColor(inactiveLabelColor); self.activeIconColor = awcSwitchColor(activeIconColor)
        self.inactiveIconColor = awcSwitchColor(inactiveIconColor); self.activeIndicatorColor = awcSwitchColor(activeIndicatorColor)
        self.activeIndicatorHeight = activeIndicatorHeight.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.dividerColor = awcSwitchColor(dividerColor)
        self.glideDuration = glideDuration.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
    }
    /// Laboratory names (the CSS hook without `--md-tab-`, camel-cased).
    public init(values: [String: AWCValue]) {
        func s(_ k: String) -> String? { values[k]?.string }
        self.init(containerColor: s("containerColor"), activeLabelColor: s("activeLabelColor"), inactiveLabelColor: s("inactiveLabelColor"),
                  activeIconColor: s("activeIconColor"), inactiveIconColor: s("inactiveIconColor"), activeIndicatorColor: s("activeIndicatorColor"),
                  activeIndicatorHeight: values["activeIndicatorHeight"]?.number, dividerColor: s("dividerColor"), glideDuration: values["glideDuration"]?.number)
    }
    public func merging(_ o: Self) -> Self {
        .init(containerColor: o.containerColor ?? containerColor, activeLabelColor: o.activeLabelColor ?? activeLabelColor,
              inactiveLabelColor: o.inactiveLabelColor ?? inactiveLabelColor, activeIconColor: o.activeIconColor ?? activeIconColor,
              inactiveIconColor: o.inactiveIconColor ?? inactiveIconColor, activeIndicatorColor: o.activeIndicatorColor ?? activeIndicatorColor,
              activeIndicatorHeight: o.activeIndicatorHeight ?? activeIndicatorHeight, dividerColor: o.dividerColor ?? dividerColor,
              glideDuration: o.glideDuration ?? glideDuration)
    }
}

/// md-tabs' two hooks (`--md-tabs-container-color`, `--md-tabs-divider-color`) plus the nine md-tab hooks set on the
/// tablist, which every tab inherits (as the custom properties inherit through the tabs' shadow roots). The flat
/// initializer names the inherited tab hooks as the Laboratory does (tabContainerColor, tabDividerColor for the md-tab
/// container and divider hooks).
public struct AWCTabsAppearance: Equatable, Sendable {
    public let containerColor: String?, dividerColor: String?
    public let tab: AWCTabAppearance
    public init(containerColor: String? = nil, dividerColor: String? = nil, tab: AWCTabAppearance) {
        self.containerColor = awcSwitchColor(containerColor); self.dividerColor = awcSwitchColor(dividerColor); self.tab = tab
    }
    public init(containerColor: String? = nil, dividerColor: String? = nil, tabContainerColor: String? = nil, activeLabelColor: String? = nil,
                inactiveLabelColor: String? = nil, activeIconColor: String? = nil, inactiveIconColor: String? = nil, activeIndicatorColor: String? = nil,
                activeIndicatorHeight: Double? = nil, tabDividerColor: String? = nil, glideDuration: Double? = nil) {
        self.init(containerColor: containerColor, dividerColor: dividerColor,
                  tab: AWCTabAppearance(containerColor: tabContainerColor, activeLabelColor: activeLabelColor, inactiveLabelColor: inactiveLabelColor,
                                        activeIconColor: activeIconColor, inactiveIconColor: inactiveIconColor, activeIndicatorColor: activeIndicatorColor,
                                        activeIndicatorHeight: activeIndicatorHeight, dividerColor: tabDividerColor, glideDuration: glideDuration))
    }
    /// Laboratory names: containerColor, dividerColor (md-tabs) and tabContainerColor, activeLabelColor, inactiveLabelColor,
    /// activeIconColor, inactiveIconColor, activeIndicatorColor, activeIndicatorHeight, tabDividerColor, glideDuration (md-tab, inherited).
    public init(values: [String: AWCValue]) {
        func s(_ k: String) -> String? { values[k]?.string }
        self.init(containerColor: s("containerColor"), dividerColor: s("dividerColor"), tabContainerColor: s("tabContainerColor"),
                  activeLabelColor: s("activeLabelColor"), inactiveLabelColor: s("inactiveLabelColor"), activeIconColor: s("activeIconColor"),
                  inactiveIconColor: s("inactiveIconColor"), activeIndicatorColor: s("activeIndicatorColor"),
                  activeIndicatorHeight: values["activeIndicatorHeight"]?.number, tabDividerColor: s("tabDividerColor"), glideDuration: values["glideDuration"]?.number)
    }
    public func merging(_ o: Self) -> Self { .init(containerColor: o.containerColor ?? containerColor, dividerColor: o.dividerColor ?? dividerColor, tab: tab.merging(o.tab)) }
}

/// `::part()` styling of md-tab: state-layer (background-color, opacity), icon / label (color), indicator / divider
/// (background-color). Part rules come from the outer tree, so they win over the hooks and every internal state rule (a fixed
/// state-layer opacity shows in every state, as in Chrome). `content` is a layout wrapper with no paint of its own (exception
/// record in md-tabs.md).
public struct AWCTabPartAppearance: Equatable, Sendable {
    public let stateLayerColor: String?, stateLayerOpacity: Double?, iconColor: String?, labelColor: String?, indicatorColor: String?, dividerColor: String?
    public init(stateLayerColor: String? = nil, stateLayerOpacity: Double? = nil, iconColor: String? = nil, labelColor: String? = nil,
                indicatorColor: String? = nil, dividerColor: String? = nil) {
        func c(_ v: String?) -> String? { v.flatMap { $0.isEmpty ? nil : $0 } }
        self.stateLayerColor = c(stateLayerColor); self.stateLayerOpacity = stateLayerOpacity.flatMap { $0.isFinite ? min(1, max(0, $0)) : nil }
        self.iconColor = c(iconColor); self.labelColor = c(labelColor); self.indicatorColor = c(indicatorColor); self.dividerColor = c(dividerColor)
    }
    /// Laboratory names (the fields above).
    public init(values: [String: AWCValue]) {
        self.init(stateLayerColor: values["stateLayerColor"]?.string, stateLayerOpacity: values["stateLayerOpacity"]?.number, iconColor: values["iconColor"]?.string,
                  labelColor: values["labelColor"]?.string, indicatorColor: values["indicatorColor"]?.string, dividerColor: values["dividerColor"]?.string)
    }
    public func merging(_ o: Self) -> Self {
        .init(stateLayerColor: o.stateLayerColor ?? stateLayerColor, stateLayerOpacity: o.stateLayerOpacity ?? stateLayerOpacity, iconColor: o.iconColor ?? iconColor,
              labelColor: o.labelColor ?? labelColor, indicatorColor: o.indicatorColor ?? indicatorColor, dividerColor: o.dividerColor ?? dividerColor)
    }
}
/// `::part(container)` of md-tabs: the scrolling strip's background-color (painted over the host background).
public struct AWCTabsPartAppearance: Equatable, Sendable {
    public let containerColor: String?
    public init(containerColor: String? = nil) { self.containerColor = containerColor.flatMap { $0.isEmpty ? nil : $0 } }
    public init(values: [String: AWCValue]) { self.init(containerColor: values["containerColor"]?.string) }
    public func merging(_ o: Self) -> Self { .init(containerColor: o.containerColor ?? containerColor) }
}
private struct AWCTabPartAppearanceKey: EnvironmentKey { static let defaultValue = AWCTabPartAppearance() }
private struct AWCTabPartAppearanceTargetsKey: EnvironmentKey { static let defaultValue: [String: AWCTabPartAppearance] = [:] }
private struct AWCTabsPartAppearanceKey: EnvironmentKey { static let defaultValue = AWCTabsPartAppearance() }
extension EnvironmentValues {
    var awcTabPartAppearance: AWCTabPartAppearance { get { self[AWCTabPartAppearanceKey.self] } set { self[AWCTabPartAppearanceKey.self] = newValue } }
    var awcTabPartAppearanceTargets: [String: AWCTabPartAppearance] { get { self[AWCTabPartAppearanceTargetsKey.self] } set { self[AWCTabPartAppearanceTargetsKey.self] = newValue } }
    var awcTabsPartAppearance: AWCTabsPartAppearance { get { self[AWCTabsPartAppearanceKey.self] } set { self[AWCTabsPartAppearanceKey.self] = newValue } }
}
private struct AWCTabPartAppearanceModifier: ViewModifier {
    let value: AWCTabPartAppearance, id: String?
    @Environment(\.awcTabPartAppearance) private var inherited
    @Environment(\.awcTabPartAppearanceTargets) private var targets
    func body(content: Content) -> some View {
        if let id { var t = targets; t[id] = (t[id] ?? .init()).merging(value); return AnyView(content.environment(\.awcTabPartAppearanceTargets, t)) }
        return AnyView(content.environment(\.awcTabPartAppearance, inherited.merging(value)))
    }
}
private struct AWCTabsPartAppearanceModifier: ViewModifier {
    let value: AWCTabsPartAppearance
    @Environment(\.awcTabsPartAppearance) private var inherited
    func body(content: Content) -> some View { content.environment(\.awcTabsPartAppearance, inherited.merging(value)) }
}
public extension View {
    /// Applies md-tab `::part()` styling to descendant tabs, or to the tab with `id`.
    func awcTabPartAppearance(_ value: AWCTabPartAppearance, for id: String? = nil) -> some View { modifier(AWCTabPartAppearanceModifier(value: value, id: id)) }
    /// Applies md-tabs `::part(container)` styling to descendant tab strips.
    func awcTabsPartAppearance(_ value: AWCTabsPartAppearance) -> some View { modifier(AWCTabsPartAppearanceModifier(value: value)) }
}

/// md-tabs' public method. `selectTab(index)` ignores an out-of-range index, then activates and emits like a click.
@MainActor @Observable public final class AWCTabsController {
    @ObservationIgnored var select: ((Int) -> Void)?
    nonisolated public init() {}
    public func selectTab(_ index: Int) { select?(index) }
}

private struct AWCTabsAppearanceKey: EnvironmentKey { static let defaultValue = AWCTabsAppearance() }
private struct AWCTabAppearanceKey: EnvironmentKey { static let defaultValue = AWCTabAppearance() }
private struct AWCTabsControllerKey: EnvironmentKey { static let defaultValue: AWCTabsController? = nil }
private struct AWCTabsReducedMotionKey: EnvironmentKey { static let defaultValue: Bool? = nil }
private struct AWCPrecedingTabsKey: EnvironmentKey { static let defaultValue: String? = nil }
public extension EnvironmentValues {
    var awcTabsAppearance: AWCTabsAppearance { get { self[AWCTabsAppearanceKey.self] } set { self[AWCTabsAppearanceKey.self] = newValue } }
    var awcTabAppearance: AWCTabAppearance { get { self[AWCTabAppearanceKey.self] } set { self[AWCTabAppearanceKey.self] = newValue } }
    var awcTabsController: AWCTabsController? { get { self[AWCTabsControllerKey.self] } set { self[AWCTabsControllerKey.self] = newValue } }
    /// Overrides the system Reduce Motion setting for tabs (nil follows the system).
    var awcTabsReducedMotion: Bool? { get { self[AWCTabsReducedMotionKey.self] } set { self[AWCTabsReducedMotionKey.self] = newValue } }
}
extension EnvironmentValues {
    /// The nearest preceding md-tabs sibling of an md-tab-panels node (set by the parent renderer).
    var awcPrecedingTabsID: String? { get { self[AWCPrecedingTabsKey.self] } set { self[AWCPrecedingTabsKey.self] = newValue } }
}
private struct AWCTabsAppearanceModifier: ViewModifier {
    let value: AWCTabsAppearance
    @Environment(\.awcTabsAppearance) private var inherited
    func body(content: Content) -> some View { content.environment(\.awcTabsAppearance, inherited.merging(value)) }
}
private struct AWCTabAppearanceModifier: ViewModifier {
    let value: AWCTabAppearance
    @Environment(\.awcTabAppearance) private var inherited
    func body(content: Content) -> some View { content.environment(\.awcTabAppearance, inherited.merging(value)) }
}
public extension View {
    func awcTabsAppearance(_ value: AWCTabsAppearance) -> some View { modifier(AWCTabsAppearanceModifier(value: value)) }
    func awcTabAppearance(_ value: AWCTabAppearance) -> some View { modifier(AWCTabAppearanceModifier(value: value)) }
    func awcTabsController(_ controller: AWCTabsController) -> some View { environment(\.awcTabsController, controller) }
}

// MARK: - Motion (CSS transitions on the frame clock)

struct AWCTabsCurve: Equatable {
    let x1: Double, y1: Double, x2: Double, y2: Double
    static let standard = AWCTabsCurve(x1: 0.2, y1: 0, x2: 0, y2: 1)
    static let emphasizedDecelerate = AWCTabsCurve(x1: 0.05, y1: 0.7, x2: 0.1, y2: 1)
    func callAsFunction(_ p: Double) -> Double { p <= 0 ? 0 : p >= 1 ? 1 : AWCNativeButtonTiming.cubic(p, x1: x1, y1: y1, x2: x2, y2: y2) }
}

/// One CSS transition: a new target starts from the current value; a target equal to the running transition's
/// reversing-adjusted start value shortens the duration by the reversing shortening factor (CSS Transitions §3).
struct AWCTabsTrack {
    private(set) var from: [Double], to: [Double]
    private(set) var start = -Double.infinity, duration = 0.0, curve = AWCTabsCurve.standard
    private var reversingStart: [Double], factor = 1.0
    init(_ v: [Double]) { from = v; to = v; reversingStart = v }
    func eased(_ t: Double) -> Double { duration <= 0 || t >= start + duration ? 1 : t <= start ? 0 : curve((t - start) / duration) }
    func value(_ t: Double) -> [Double] { let p = eased(t); return zip(from, to).map { $0 + ($1 - $0) * p } }
    func running(_ t: Double) -> Bool { duration > 0 && t < start + duration }
    mutating func snap(_ v: [Double]) { from = v; to = v; duration = 0; start = -.infinity; reversingStart = v; factor = 1 }
    mutating func set(_ target: [Double], duration d: Double, curve c: AWCTabsCurve, now: Double, delay: Double = 0) {
        guard target != to else { return }
        if d <= 0 { snap(target); return }
        let current = value(now)
        if running(now), target == reversingStart {
            let f = min(1, max(0, abs(eased(now) * factor + 1 - factor)))
            reversingStart = to; factor = f; from = current; to = target; start = now + delay * f; duration = d * f; curve = c
        } else {
            reversingStart = current; factor = 1; from = current; to = target; start = now + delay; duration = d; curve = c
        }
    }
}

/// The per-tab transitions: indicator opacity and transform (translateX, scaleX), host and icon colour, state layer.
final class AWCTabMotion {
    var indicatorOpacity = AWCTabsTrack([0]), indicator = AWCTabsTrack([0, 1])
    var color = AWCTabsTrack([0, 0, 0, 1]), icon = AWCTabsTrack([0, 0, 0, 1]), layer = AWCTabsTrack([0])
    var initialized = false
    func running(_ t: Double) -> Bool { [indicatorOpacity, indicator, color, icon, layer].contains { $0.running(t) } }
}

enum AWCTabsClock {
    static func now() -> Double { CACurrentMediaTime() * 1000 }
    /// Paused: one entry now (the content renders) and none after; running: 120 Hz.
    static func schedule(paused: Bool) -> PeriodicTimelineSchedule { .periodic(from: .now, by: paused ? 3600 : 1.0 / 120) }
}

func awcTabsComponents(_ c: Color) -> [Double] {
    let r = c.resolve(in: EnvironmentValues()); return [Double(r.red), Double(r.green), Double(r.blue), Double(r.opacity)]
}
func awcTabsColor(_ v: [Double]) -> Color { Color(.sRGB, red: v[0], green: v[1], blue: v[2], opacity: v[3]) }
func awcTabsRGBA(_ v: [Double]) -> AWCValue { .array(v.map { .number($0) }) }

// MARK: - Fonts

extension AWCNativeFonts {
    /// Advance width of a single-run label (Roboto at the CSS weight, kerning on, CSS letter-spacing after every character).
    static func tabTextWidth(_ text: String, size: CGFloat, weight: Double = 500, tracking: Double = 0.1) -> Double {
        _ = label(size: size, weight: 500)
        let font = CTFontCreateWithName((weight >= 600 ? "Roboto-Bold" : weight >= 500 ? "Roboto-Medium" : "Roboto-Regular") as CFString, size, nil)
        let line = CTLineCreateWithAttributedString(NSAttributedString(string: text, attributes: [NSAttributedString.Key(kCTFontAttributeName as String): font]))
        return Double(CTLineGetTypographicBounds(line, nil, nil, nil)) + tracking * Double(text.count)
    }
}

// MARK: - Model and geometry

/// The density-derived lengths of md-tab (every value derives from --md-sys-density-scale by calc).
struct AWCTabMetrics {
    let d: Double
    var minWidth: Double { max(48, 90 + 8 * d) }
    var padX: Double { max(8, 16 + 2 * d) }
    var icon: Double { max(18, 24 + d) }
    var labelSize: Double { max(11, 14 + 0.5 * d) }
    var lineHeight: Double { max(16, 20 + d) }
    func height(stackedPrimary: Bool) -> Double { (stackedPrimary ? 64 : 48) + 4 * d }
}

/// One md-tab as the strip sees it (derived anatomy: stacked, inline, label-only, icon-only).
struct AWCTabSpec {
    let node: AWCNode
    var id: String { node.id }
    var p: [String: AWCValue] { node.properties }
    var label: String { p["label"]?.string ?? "" }
    var icon: String { p["icon"]?.string ?? "" }
    var slotIcon: AWCNode? { node.children.first { $0.slot == "icon" } }
    var slotBadge: AWCNode? { node.children.first { $0.slot == "badge" } }
    /// nil: no badge; "": a dot; text: a large badge.
    var badge: String? { if case .string(let s)? = p["badge"] { return s }; if let n = p["badge"]?.number { return n == n.rounded() ? String(Int(n)) : String(n) }; return nil }
    var disabled: Bool { p["disabled"]?.bool == true }
    var hasIcon: Bool { !icon.isEmpty || slotIcon != nil }
    var hasLabel: Bool { !label.isEmpty }
    var inline: Bool { p["inlineIcon"]?.bool == true && hasIcon && hasLabel }
    var stacked: Bool { hasIcon && hasLabel && !inline }
    var ariaLabel: String { [p["ariaLabelProp"]?.string, p["aria-label"]?.string, p["ariaLabel"]?.string].compactMap { $0 }.first { !$0.isEmpty } ?? "" }
    /// The accessible name: aria-label, else the content in tree order (badge on the icon, label, inline badge).
    var name: String {
        if !ariaLabel.isEmpty { return ariaLabel }
        let badgeName = slotBadge.map { $0.authoredTextContent.trimmingCharacters(in: .whitespacesAndNewlines) } ?? badge.map { $0.isEmpty ? "notification" : $0 }
        return ([hasIcon ? badgeName : nil, hasLabel ? label : nil, !hasIcon ? badgeName : nil].compactMap { $0 }.filter { !$0.isEmpty }).joined(separator: " ")
    }
    func density(inherited: Double) -> Double { AWCNativeDensity.resolve(p["density"]?.number, inherited: inherited) }
}

/// Tab-local geometry (points, physical x) of one tab at a given width.
struct AWCTabGeometry {
    var x = 0.0, width = 0.0, height = 0.0
    var content = CGRect.zero, icon: CGRect?, label: CGRect?, labelText = CGRect.zero, badge: CGRect?, inlineBadge = false
    var indicator = CGRect.zero, divider = CGRect.zero
    var stacked = false, inline = false, kind = "label"
}

struct AWCTabsLayoutInput {
    let specs: [AWCTabSpec], primary: Bool, mode: String, fixed: Double?, viewport: Double, rtl: Bool
    let inheritedDensity: Double, indicatorHeight: Double?, slotWidths: [String: Double]
}

enum AWCTabsLayout {
    static func badgeSize(_ b: String) -> CGSize {
        b.isEmpty ? CGSize(width: 6, height: 6) : CGSize(width: max(6, AWCNativeFonts.tabTextWidth(b, size: 10, tracking: 0)) + 6, height: 14)
    }
    /// The max-content width of a tab (padding + inner), never below its minimum.
    static func intrinsic(_ s: AWCTabSpec, _ m: AWCTabMetrics, primary: Bool, slotWidths: [String: Double]) -> Double {
        let content = contentSize(s, m, slotWidths: slotWidths).width
        return max(m.minWidth, 2 * m.padX + (primary ? max(content, 24) : content))
    }
    static func labelWidth(_ s: AWCTabSpec, _ m: AWCTabMetrics, slotWidths: [String: Double]) -> (text: Double, total: Double) {
        let text = s.hasLabel ? AWCNativeFonts.tabTextWidth(s.label, size: CGFloat(m.labelSize)) : 0
        var total = text
        if !s.hasIcon {
            if let slot = s.slotBadge { total += 4 + (slotWidths[slot.id] ?? 0) } else if let b = s.badge { total += 4 + Double(badgeSize(b).width) }
        }
        return (text, total)
    }
    static func contentSize(_ s: AWCTabSpec, _ m: AWCTabMetrics, slotWidths: [String: Double]) -> CGSize {
        let label = labelWidth(s, m, slotWidths: slotWidths).total
        if s.inline { return CGSize(width: m.icon + 8 + label, height: max(m.icon, m.lineHeight)) }
        if s.stacked { return CGSize(width: max(m.icon, label), height: m.icon + 2 + m.lineHeight) }
        if s.hasIcon { return CGSize(width: m.icon, height: m.icon) }
        return CGSize(width: label, height: s.hasLabel ? m.lineHeight : 0)
    }
    /// Widths along the strip: `equal` shares the viewport (flex 1 1 0 with each tab's minimum, frozen on violation),
    /// `auto` hugs the content, a length applies exactly.
    static func widths(_ input: AWCTabsLayoutInput) -> [Double] {
        let metrics = input.specs.map { AWCTabMetrics(d: $0.density(inherited: input.inheritedDensity)) }
        if let fixed = input.fixed { return input.specs.map { _ in fixed } }
        if input.mode == "auto" { return zip(input.specs, metrics).map { intrinsic($0, $1, primary: input.primary, slotWidths: input.slotWidths) } }
        var result = [Double?](repeating: nil, count: input.specs.count)
        while true {
            let open = result.indices.filter { result[$0] == nil }
            guard !open.isEmpty else { break }
            let share = (input.viewport - result.compactMap { $0 }.reduce(0, +)) / Double(open.count)
            let violators = open.filter { share < metrics[$0].minWidth }
            if violators.isEmpty { for i in open { result[i] = max(0, share) }; break }
            for i in violators { result[i] = metrics[i].minWidth }
        }
        return result.map { $0 ?? 0 }
    }
    static func geometry(_ s: AWCTabSpec, width w: Double, primary: Bool, rtl: Bool, inheritedDensity: Double, indicatorHeight: Double?, slotWidths: [String: Double]) -> AWCTabGeometry {
        let m = AWCTabMetrics(d: s.density(inherited: inheritedDensity))
        var g = AWCTabGeometry(); g.width = w; g.stacked = s.stacked; g.inline = s.inline
        g.kind = s.inline ? "inline" : s.stacked ? "stacked" : s.hasIcon ? "icon" : "label"
        let h = m.height(stackedPrimary: primary && s.stacked); g.height = h
        let indH = indicatorHeight ?? (primary ? 3 : 2)
        let avail = max(0, w - 2 * m.padX), size = contentSize(s, m, slotWidths: slotWidths)
        let lw = labelWidth(s, m, slotWidths: slotWidths)
        var box: CGRect
        if primary {
            let inner = min(max(Double(size.width), 24), avail), innerX = m.padX + (avail - inner) / 2
            box = CGRect(x: innerX, y: 0, width: inner, height: max(0, h - indH - 2))
            g.indicator = CGRect(x: innerX, y: h - indH, width: inner, height: indH)
        } else {
            let cw = min(Double(size.width), avail)
            box = CGRect(x: m.padX + (avail - cw) / 2, y: (h - Double(size.height)) / 2, width: cw, height: Double(size.height))
            g.indicator = CGRect(x: 0, y: h - indH, width: w, height: indH)
        }
        g.content = box
        let stackW = min(Double(size.width), Double(box.width)), stackH = Double(size.height)
        let stackY = Double(box.minY) + (Double(box.height) - stackH) / 2
        // The label shrinks (ellipsis) to what the content box leaves it.
        let labelRoom = s.inline ? stackW - m.icon - 8 : stackW
        let labelW = min(lw.total, max(0, labelRoom)), textW = max(0, labelW - (lw.total - lw.text))
        if s.inline {
            let rowH = max(m.icon, m.lineHeight)
            let iconX = rtl ? Double(box.minX) + stackW - m.icon : Double(box.minX)
            g.icon = CGRect(x: iconX, y: stackY + (rowH - m.icon) / 2, width: m.icon, height: m.icon)
            g.label = CGRect(x: rtl ? iconX - 8 - labelW : iconX + m.icon + 8, y: stackY + (rowH - m.lineHeight) / 2, width: labelW, height: m.lineHeight)
        } else if s.stacked {
            g.icon = CGRect(x: Double(box.midX) - m.icon / 2, y: stackY, width: m.icon, height: m.icon)
            g.label = CGRect(x: Double(box.midX) - labelW / 2, y: stackY + m.icon + 2, width: labelW, height: m.lineHeight)
        } else if s.hasIcon {
            g.icon = CGRect(x: Double(box.midX) - m.icon / 2, y: stackY, width: m.icon, height: m.icon)
        } else if s.hasLabel || s.badge != nil || s.slotBadge != nil {
            g.label = CGRect(x: Double(box.midX) - labelW / 2, y: stackY, width: labelW, height: m.lineHeight)
        }
        if let l = g.label { g.labelText = CGRect(x: rtl ? Double(l.maxX) - textW : Double(l.minX), y: Double(l.minY), width: textW, height: m.lineHeight) }
        // Badges: on the icon, anchored at the wrapper's inline-end top corner then translated (50%, -25%) — a physical
        // translate, so in RTL the badge sits half over the icon's left edge plus half its width (the source geometry);
        // label-only tabs keep it in flow after the text (gap 4).
        if s.slotBadge == nil, let b = s.badge {
            let bs = badgeSize(b)
            if let icon = g.icon {
                let anchorX = rtl ? Double(icon.minX) : Double(icon.maxX) - Double(bs.width)
                g.badge = CGRect(x: anchorX + Double(bs.width) / 2, y: Double(icon.minY) - Double(bs.height) / 4, width: Double(bs.width), height: Double(bs.height))
            } else if let l = g.label {
                g.inlineBadge = true
                g.badge = CGRect(x: rtl ? Double(l.minX) : Double(l.maxX) - Double(bs.width), y: Double(l.minY) + (m.lineHeight - Double(bs.height)) / 2, width: Double(bs.width), height: Double(bs.height))
            }
        }
        g.divider = CGRect(x: 0, y: h - 1, width: w, height: 1)
        return g
    }
    /// Physical strip layout: tabs from the inline-start edge of a content box as wide as max(total, viewport).
    static func strip(_ input: AWCTabsLayoutInput) -> (tabs: [AWCTabGeometry], content: Double, height: Double) {
        let widths = widths(input), total = widths.reduce(0, +), content = max(total, input.viewport)
        var x = 0.0, tabs: [AWCTabGeometry] = []
        for (s, w) in zip(input.specs, widths) {
            var g = geometry(s, width: w, primary: input.primary, rtl: input.rtl, inheritedDensity: input.inheritedDensity, indicatorHeight: input.indicatorHeight, slotWidths: input.slotWidths)
            g.x = input.rtl ? content - x - w : x; x += w; tabs.append(g)
        }
        return (tabs, content, tabs.map(\.height).max() ?? 0)
    }
    /// A CSS length for `tab-width` / `width`: px, rem/em (16), else nil.
    static func length(_ raw: String?) -> Double? {
        guard let raw = raw?.trimmingCharacters(in: .whitespaces).lowercased(), !raw.isEmpty else { return nil }
        for (unit, scale) in [("px", 1.0), ("rem", 16.0), ("em", 16.0)] where raw.hasSuffix(unit) { return Double(raw.dropLast(unit.count)).map { $0 * scale } }
        return Double(raw)
    }
}

// MARK: - Selection model (the md-tabs reducer)

enum AWCTabsSelection {
    /// NaN / floats / garbage never wipe the tablist: Math.round(Number(index)), non-finite → 0.
    static func sanitize(_ v: AWCValue?) -> Int {
        let n: Double
        switch v { case .number(let x)?: n = x; case .string(let s)?: n = Double(s.trimmingCharacters(in: .whitespaces)) ?? (s.trimmingCharacters(in: .whitespaces).isEmpty ? 0 : .nan)
        case .bool(let b)?: n = b ? 1 : 0; case nil, .null?: n = 0; default: n = .nan }
        let r = (n + 0.5).rounded(.down)
        return r.isFinite && abs(r) < 1e9 ? Int(r) : 0
    }
    static func next(_ disabled: [Bool], from: Int, _ dir: Int) -> Int? {
        let n = disabled.count; guard n > 0 else { return nil }
        var i = from
        for _ in 0..<n { i = ((i + dir) % n + n) % n; if !disabled[i] { return i } }
        return nil
    }
    static func first(_ disabled: [Bool]) -> Int? { disabled.firstIndex(of: false) }
    static func last(_ disabled: [Bool]) -> Int? { disabled.lastIndex(of: false) }
    /// Clamp into range, preferring an enabled tab (the next enabled with wrap, else the first).
    static func clamp(_ index: Int, _ disabled: [Bool]) -> Int {
        guard !disabled.isEmpty else { return 0 }
        var i = max(0, min(index, disabled.count - 1))
        if disabled[i], let e = next(disabled, from: i, 1) ?? first(disabled) { i = e }
        return i
    }
}

// MARK: - Runtime

@MainActor @Observable final class AWCTabsRuntime {
    /// The active tab by identity (selection survives reorders/removals), and the activeTabIndex value.
    var activeID: String?
    var index = 0
    var hoverID: String?
    var pressedID: String?
    /// The strip's scroll position (points from the physical left edge of the content) and its smooth-scroll transition.
    var scrollVersion = 0
    @ObservationIgnored var scroll = AWCTabsTrack([0])
    @ObservationIgnored var scrollMax = 0.0
    @ObservationIgnored var dragStart: Double?
    @ObservationIgnored var initialScroll = false
    var slotWidths: [String: Double] = [:]
    var tick = 0
    @ObservationIgnored var pending: Int?
    @ObservationIgnored var lastProperty: AWCValue?
    @ObservationIgnored var motions: [String: AWCTabMotion] = [:]
    @ObservationIgnored var handles: [String: AWCButtonFocusHandle] = [:]
    @ObservationIgnored var ripples: [String: AWCRippleController] = [:]
    @ObservationIgnored var frames: [String: CGRect] = [:]
    @ObservationIgnored var placed: [String: AWCTabGeometry] = [:]
    @ObservationIgnored var animating = false
    init(node: AWCNode) {
        let tabs = node.children.filter { $0.tag == "md-tab" }, disabled = tabs.map { $0.properties["disabled"]?.bool == true }
        lastProperty = node.properties["activeTabIndex"]
        index = AWCTabsSelection.clamp(AWCTabsSelection.sanitize(lastProperty), disabled)
        activeID = AWCTabsSelection.first(disabled) == nil || tabs.isEmpty ? nil : tabs[index].id
        if node.properties["_standalone"]?.bool == true { index = 0; activeID = tabs.first.flatMap { $0.properties["active"]?.bool == true ? $0.id : nil } }
    }
    func motion(_ id: String) -> AWCTabMotion { if let m = motions[id] { return m }; let m = AWCTabMotion(); motions[id] = m; return m }
    func handle(_ id: String) -> AWCButtonFocusHandle { if let h = handles[id] { return h }; let h = AWCButtonFocusHandle(); handles[id] = h; return h }
    func ripple(_ id: String) -> AWCRippleController { if let r = ripples[id] { return r }; let r = AWCRippleController(); ripples[id] = r; return r }
    func scrollX(_ now: Double) -> Double { min(max(scroll.value(now)[0], 0), scrollMax) }
    /// Smooth scroll (reduced motion: instant), clamped to the scroll range.
    func scroll(toLeft x: Double, animated: Bool) {
        let now = AWCTabsClock.now(), target = min(max(x, 0), scrollMax)
        if animated {
            scroll.set([target], duration: 300, curve: AWCTabsCurve(x1: 0.42, y1: 0, x2: 0.58, y2: 1), now: now)
            // The strip's own state (edge fades, scroll metrics) refreshes once the smooth scroll has settled.
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.32) { [weak self] in self?.scrollVersion &+= 1 }
        } else { scroll.snap([target]) }
        scrollVersion &+= 1
    }
}

/// Places the tabs at their physical x (the strip lays out LTR; RTL order is computed by the model).
struct AWCTabsRow: Layout {
    let frames: [CGRect], size: CGSize
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize { size }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        for (s, f) in zip(subviews, frames) { s.place(at: CGPoint(x: bounds.minX + f.minX, y: bounds.minY + f.minY), anchor: .topLeading, proposal: ProposedViewSize(f.size)) }
    }
}


// MARK: - Palette

struct AWCTabsPalette {
    let tokens: [String: String], tabs: AWCTabsAppearance, tab: AWCTabAppearance, primary: Bool, full: Bool
    func token(_ k: String, _ d: String) -> Color { Color(awcHex: tokens["--md-sys-color-" + k] ?? d) }
    func hex(_ v: String?) -> Color? { v.map { Color(awcHex: $0) } }
    var host: Color { hex(tabs.containerColor) ?? token("surface", "#FFFBFE") }
    var stripDivider: Color { hex(tabs.dividerColor) ?? token("outline-variant", "#CAC4D0") }
    var container: Color { hex(tab.containerColor) ?? .clear }
    var activeLabel: Color { hex(tab.activeLabelColor) ?? (primary ? token("primary", "#6750A4") : token("on-surface", "#1C1B1F")) }
    var inactiveLabel: Color { hex(tab.inactiveLabelColor) ?? token("on-surface-variant", "#49454F") }
    var activeIcon: Color { hex(tab.activeIconColor) ?? token("primary", "#6750A4") }
    var inactiveIcon: Color { hex(tab.inactiveIconColor) ?? token("on-surface-variant", "#49454F") }
    var indicator: Color { hex(tab.activeIndicatorColor) ?? token("primary", "#6750A4") }
    var disabled: Color { token("on-surface", "#1C1B1F").opacity(0.38) }
    /// `full` suppresses the per-tab segments with --md-tab-divider-color: transparent on the host; an explicit tab
    /// divider hook (inline style) still wins.
    var tabDivider: Color { hex(tab.dividerColor) ?? (full ? .clear : hex(tabs.dividerColor) ?? token("outline-variant", "#CAC4D0")) }
    var focusRing: Color { token("secondary", "#625B71") }
    var badge: Color { token("error", "#B3261E") }
    var onBadge: Color { token("on-error", "#FFFFFF") }
}

/// A label never ellipsizes from a fractional box: below its measured advance it keeps its natural width.
struct AWCTabLabelBox: Layout {
    let measured: Double
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        CGSize(width: proposal.width ?? measured, height: proposal.height ?? subviews.first?.sizeThatFits(.unspecified).height ?? 0)
    }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        guard let v = subviews.first else { return }
        let truncating = measured > Double(bounds.width) + 0.01
        let h = v.sizeThatFits(.unspecified).height
        v.place(at: CGPoint(x: bounds.minX, y: bounds.midY - h / 2), anchor: .topLeading, proposal: ProposedViewSize(width: truncating ? bounds.width : nil, height: nil))
    }
}

/// The per-render state of one tab (targets of its transitions are set from it).
struct AWCTabState {
    let active: Bool, disabled: Bool, hover: Bool, pressed: Bool, focused: Bool, focusVisible: Bool, tabStop: Bool
}

/// md-tabs: the tablist. Selection (clamp, skip disabled, append-and-select, identity across mutations, emit only on
/// user activation / selectTab / reconciliation), roving tab stop, arrows in visual order with Home/End and automatic
/// activation, the strip (equal / auto / length widths, scroll with nearest-edge reveal and edge fades), the full or
/// per-tab divider, the indicator glide (FLIP from the outgoing indicator, 400 ms emphasized-decelerate after one
/// frame) and the outgoing fade (200 ms; 150 ms secondary), colour (200 ms) and state-layer (50 ms) transitions.
struct AWCNativeTabs: View {
    let node: AWCNode
    let properties: [String: AWCValue]
    let theme: AWCTheme
    let inheritedDensity: Double
    let store: AWCInteractionStore
    /// (event, target node id, target tag, detail)
    let emit: (String, String, String, AWCValue) -> Void
    let setIndexProperty: (Int) -> Void
    let renderChild: (AWCNode) -> AnyView
    @Environment(\.layoutDirection) private var direction
    @Environment(\.accessibilityReduceMotion) private var systemReduceMotion
    @Environment(\.awcTabsReducedMotion) private var reducedOverride
    @Environment(\.awcThemeTokens) private var tokens
    @Environment(\.awcTabsAppearance) private var appearance
    @Environment(\.awcTabAppearance) private var tabAppearance
    @Environment(\.awcTabPartAppearance) private var tabPartAppearance
    @Environment(\.awcTabPartAppearanceTargets) private var tabPartTargets
    @Environment(\.awcTabsPartAppearance) private var tabsPartAppearance
    /// The tab's `::part()` styling (descendant scope merged with its id target).
    func partStyle(_ id: String) -> AWCTabPartAppearance { tabPartAppearance.merging(tabPartTargets[id] ?? .init()) }
    @Environment(\.awcTabsController) private var controller
    @Environment(\.awcNativePointerState) private var pointer
    @State private var runtime: AWCTabsRuntime
    @State private var viewport: CGFloat = 0
    init(node: AWCNode, properties: [String: AWCValue], theme: AWCTheme, inheritedDensity: Double, store: AWCInteractionStore,
         emit: @escaping (String, String, String, AWCValue) -> Void, setIndexProperty: @escaping (Int) -> Void, renderChild: @escaping (AWCNode) -> AnyView) {
        self.node = node; self.properties = properties; self.theme = theme; self.inheritedDensity = inheritedDensity; self.store = store
        self.emit = emit; self.setIndexProperty = setIndexProperty; self.renderChild = renderChild
        _runtime = State(initialValue: AWCTabsRuntime(node: node))
    }
    var reduced: Bool { reducedOverride ?? systemReduceMotion }
    var rtl: Bool { direction == .rightToLeft }
    var primary: Bool { (properties["variant"]?.string ?? "primary") != "secondary" }
    var full: Bool { properties["divider"]?.string != "auto" }
    var specs: [AWCTabSpec] { node.children.filter { $0.tag == "md-tab" }.map(AWCTabSpec.init) }
    var label: String { [properties["ariaLabelProp"]?.string, properties["aria-label"]?.string, properties["ariaLabel"]?.string].compactMap { $0 }.first { !$0.isEmpty } ?? "tabs" }
    var widthMode: (mode: String, fixed: Double?) {
        let raw = (properties["tabWidth"]?.string ?? "equal").trimmingCharacters(in: .whitespaces)
        if raw == "auto" { return ("auto", nil) }
        if raw.isEmpty || raw == "equal" { return ("equal", nil) }
        return AWCTabsLayout.length(raw).map { ("fixed", $0) } ?? ("equal", nil)
    }
    var stripWidth: Double? { AWCTabsLayout.length(properties["width"]?.string) }
    var tabLook: AWCTabAppearance { appearance.tab.merging(tabAppearance) }
    /// A tab outside a tablist: its own `active`, its own tab stop, mdTabClick only, its own divider segment.
    var standalone: Bool { properties["_standalone"]?.bool == true }

    // MARK: Selection

    func disabled(_ specs: [AWCTabSpec]) -> [Bool] { specs.map(\.disabled) }
    /// md-tabs is the only tab-stop writer: exactly one tab is focusable — the active one, or the first enabled tab.
    func holder(_ specs: [AWCTabSpec]) -> String? {
        let d = disabled(specs)
        guard !specs.isEmpty else { return nil }
        if standalone { return d[0] ? nil : specs[0].id }
        if specs.indices.contains(runtime.index), !d[runtime.index] { return specs[runtime.index].id }
        return AWCTabsSelection.first(d).map { specs[$0].id }
    }
    func publish(_ specs: [AWCTabSpec]) {
        guard !standalone else { return }
        let value = runtime.activeID == nil ? -1 : runtime.index
        if store.tabIndices[node.id] != value { store.tabIndices[node.id] = value }
        let names = specs.map(\.name)
        if store.tabLabels[node.id] != names { store.tabLabels[node.id] = names }
    }
    /// The single application path: active state, roving stop, scroll, glide.
    func apply(_ index: Int, _ specs: [AWCTabSpec], scroll: Bool = true) {
        let previous = runtime.activeID, next = specs.indices.contains(index) ? specs[index].id : nil
        runtime.activeID = next
        if scroll, let next { revealTab(next, animated: !reduced) }
        if let previous, let next, previous != next, !reduced { glide(from: previous, to: next) }
        publish(specs)
    }
    /// Pointer, Enter/Space, arrows, Home/End and selectTab(): activate and emit {index, previousIndex}.
    func activate(_ index: Int, _ specs: [AWCTabSpec]) {
        runtime.pending = nil
        guard specs.indices.contains(index) else { return }
        if index == runtime.index && runtime.activeID == specs[index].id { return }
        let previous = runtime.index
        runtime.index = index; setIndexProperty(index)
        apply(index, specs)
        emit("mdTabChange", node.id, "md-tabs", .object(["index": .number(Double(index)), "previousIndex": .number(Double(previous))]))
    }
    /// A write to activeTabIndex: silent, clamped, skips disabled tabs, remembers an index past the end.
    func programmatic(_ raw: AWCValue?, _ specs: [AWCTabSpec]) {
        let s = AWCTabsSelection.sanitize(raw)
        runtime.pending = s > specs.count - 1 ? s : nil
        let c = AWCTabsSelection.clamp(s, disabled(specs))
        runtime.index = c
        apply(c, specs)
    }
    /// Selection integrity across mutations: follow the active element, honour a pending index, clamp otherwise.
    func reconcile(_ specs: [AWCTabSpec]) {
        guard !specs.isEmpty else { runtime.activeID = nil; publish(specs); return }
        let d = disabled(specs), ids = specs.map(\.id)
        if let p = runtime.pending {
            runtime.pending = nil
            if p <= specs.count - 1 { let i = AWCTabsSelection.clamp(p, d); runtime.index = i; setIndexProperty(i); apply(i, specs); return }
        }
        if AWCTabsSelection.first(d) == nil {
            let had = runtime.activeID != nil, previous = runtime.index
            runtime.activeID = nil; publish(specs)
            if had { emit("mdTabChange", node.id, "md-tabs", .object(["index": .number(-1), "previousIndex": .number(Double(previous))])) }
            return
        }
        let previousElement = runtime.activeID
        let index = previousElement.flatMap { ids.firstIndex(of: $0) } ?? AWCTabsSelection.clamp(runtime.index, d)
        let previous = runtime.index
        runtime.index = index; if previous != index { setIndexProperty(index) }
        apply(index, specs, scroll: false)
        if previousElement != nil && runtime.activeID != previousElement {
            emit("mdTabChange", node.id, "md-tabs", .object(["index": .number(Double(index)), "previousIndex": .number(Double(previous))]))
        }
    }
    func click(_ index: Int, _ specs: [AWCTabSpec]) {
        guard specs.indices.contains(index), !specs[index].disabled else { return }
        emit("mdTabClick", specs[index].id, "md-tab", .null)
        if !standalone { activate(index, specs) }
    }
    /// Arrows follow the visual direction (RTL: ArrowRight goes to lower indexes), wrap and skip disabled tabs; Home/End
    /// go to the first/last enabled tab. Focus moves with the ring and the tab activates. Modifiers are ignored (source).
    func key(_ key: String, from id: String) -> Bool {
        let specs = specs, d = disabled(specs)
        guard !standalone, let current = specs.firstIndex(where: { $0.id == id }) else { return false }
        let dir = rtl ? -1 : 1
        let target: Int?
        switch key {
        case "ArrowRight": target = AWCTabsSelection.next(d, from: current, dir)
        case "ArrowLeft": target = AWCTabsSelection.next(d, from: current, -dir)
        case "Home": target = AWCTabsSelection.first(d)
        case "End": target = AWCTabsSelection.last(d)
        default: return false
        }
        if let t = target, t != current {
            _ = runtime.handle(specs[t].id).requestFocus?()
            activate(t, specs)
        }
        return true
    }

    // MARK: Motion

    /// FLIP: the incoming indicator starts at the outgoing one's rendered box (centre delta, width ratio against its own
    /// rendered — usually parked 0.88 — width), held for one frame, then transitions home over 400 ms.
    func glide(from previous: String, to next: String) {
        guard let pg = runtime.placed[previous], let ng = runtime.placed[next] else { return }
        let now = AWCTabsClock.now(), pm = runtime.motion(previous), nm = runtime.motion(next)
        func rendered(_ m: AWCTabMotion, _ g: AWCTabGeometry) -> (c: Double, w: Double) {
            let v = m.indicator.value(now); return (g.x + Double(g.indicator.midX) + v[0], Double(g.indicator.width) * v[1])
        }
        let p = rendered(pm, pg), n = rendered(nm, ng)
        guard p.w > 0, n.w > 0, pm.initialized, nm.initialized else { return }
        nm.indicator.snap([p.c - n.c, p.w / n.w])
        nm.indicator.set([0, 1], duration: tabLook.glideDuration ?? 400, curve: .emphasizedDecelerate, now: now, delay: 1000.0 / 60)
        runtime.tick &+= 1
    }
    /// Sets the transition targets of one tab for this render (a changed target starts a transition at `now`).
    func targets(_ s: AWCTabSpec, _ st: AWCTabState, _ palette: AWCTabsPalette, now: Double) {
        let m = runtime.motion(s.id)
        let color = awcTabsComponents(st.disabled ? palette.disabled : st.active ? palette.activeLabel : palette.inactiveLabel)
        let ps = partStyle(s.id)
        let icon = awcTabsComponents(ps.iconColor.map { Color(awcHex: $0) } ?? (st.active ? palette.activeIcon : palette.inactiveIcon))
        let layer = ps.stateLayerOpacity ?? (st.disabled ? 0 : st.pressed || st.focusVisible ? 0.12 : st.hover ? 0.08 : 0)
        let opacity = st.active ? 1.0 : 0.0
        let transform = st.active ? [0.0, 1] : [0, primary ? 0.88 : 1]
        if !m.initialized {
            m.color.snap(color); m.icon.snap(icon); m.layer.snap([layer]); m.indicatorOpacity.snap([opacity]); m.indicator.snap(transform)
            m.initialized = true; return
        }
        m.color.set(color, duration: 200, curve: .standard, now: now)
        m.icon.set(icon, duration: 200, curve: .standard, now: now)
        m.layer.set([layer], duration: reduced ? 0 : 50, curve: .standard, now: now)
        m.indicatorOpacity.set([opacity], duration: reduced ? 0 : primary ? 200 : 150, curve: .standard, now: now)
        m.indicator.set(transform, duration: reduced ? 0 : palette.tab.glideDuration ?? 400, curve: .emphasizedDecelerate, now: now)
    }
    func state(_ s: AWCTabSpec, _ holderID: String?) -> AWCTabState {
        let handle = runtime.handle(s.id)
        let pointerHover = pointer.map { p in p.location.map { runtime.frames[s.id]?.contains($0) ?? false } ?? false }
        let hover = !s.disabled && (pointerHover ?? (runtime.hoverID == s.id))
        let pressed = !s.disabled && (runtime.pressedID == s.id || (pointer?.isPointerDown == true && hover))
        return AWCTabState(active: runtime.activeID == s.id, disabled: s.disabled, hover: hover, pressed: pressed,
                           focused: handle.isFocused, focusVisible: handle.isFocusVisible, tabStop: holderID == s.id)
    }

    // MARK: Scroll

    /// Scrolls only as far as the nearest edge that reveals the tab (an oversized tab spanning both edges stays).
    func revealTab(_ id: String, animated: Bool) {
        guard let g = runtime.placed[id], viewport > 0 else { return }
        let w = Double(stripWidth ?? Double(viewport)), left = runtime.scrollX(AWCTabsClock.now())
        let before = g.x - left, after = g.x + g.width - left - w
        if before >= -0.5 && after <= 0.5 { return }
        if before < 0 && after > 0 { return }
        let distance = abs(before) < abs(after) ? before : after
        if abs(distance) <= 0.5 { return }
        runtime.scroll(toLeft: left + distance, animated: animated)
    }
}

/// Places parts at explicit tab-local frames (real layout frames, so inspection and hit areas match the geometry).
struct AWCTabParts: Layout {
    let frames: [CGRect], size: CGSize
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize { size }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        for (s, f) in zip(subviews, frames) { s.place(at: CGPoint(x: bounds.minX + f.minX, y: bounds.minY + f.minY), anchor: .topLeading, proposal: ProposedViewSize(f.size)) }
    }
}

extension AWCNativeTabs {
    var body: some View {
        let specs = specs, now = AWCTabsClock.now()
        let mode = widthMode, look = tabLook
        func input(_ v: Double) -> AWCTabsLayoutInput {
            AWCTabsLayoutInput(specs: specs, primary: primary, mode: mode.mode, fixed: mode.fixed, viewport: v, rtl: rtl,
                               inheritedDensity: inheritedDensity, indicatorHeight: look.activeIndicatorHeight, slotWidths: runtime.slotWidths)
        }
        let fixedWidth = stripWidth ?? (standalone ? AWCTabsLayout.widths(input(0)).reduce(0, +) : nil)
        let w = fixedWidth ?? Double(viewport)
        let layout = AWCTabsLayout.strip(input(w))
        let palette = AWCTabsPalette(tokens: tokens.isEmpty ? theme.tokens : tokens, tabs: appearance, tab: look, primary: primary, full: full)
        let holderID = holder(specs)
        let states = specs.map { state($0, holderID) }
        for (i, s) in specs.enumerated() { var g = layout.tabs[i]; g.x = layout.tabs[i].x; runtime.placed[s.id] = g; targets(s, states[i], palette, now: now) }
        let _ = updateScrollRange(content: layout.content, viewport: w)
        let animating = specs.contains { runtime.motion($0.id).running(now) } || runtime.scroll.running(now)
        let _ = runtime.tick
        let _ = runtime.scrollVersion
        let _ = bindController()
        return strip(specs, layout, states, palette, width: w, fixedWidth: fixedWidth, animating: animating)
            .onAppear { publish(specs) }
            .onChange(of: specs.first?.p["active"]) { _, v in if standalone { runtime.activeID = v?.bool == true ? specs.first?.id : nil } }
            .onChange(of: specs.map(\.id)) { _, _ in reconcile(self.specs) }
            .onChange(of: node.properties["activeTabIndex"]) { _, value in
                guard value != runtime.lastProperty else { return }
                runtime.lastProperty = value; programmatic(value, self.specs)
            }
            .onChange(of: specs.map(\.name)) { _, _ in publish(self.specs) }
    }
    /// The scroll range follows the content; an RTL strip starts scrolled to its inline start (the right edge).
    func updateScrollRange(content: Double, viewport w: Double) {
        let maxX = max(0, content - w)
        guard maxX != runtime.scrollMax || !runtime.initialScroll else { return }
        let wasAtEnd = runtime.scrollX(AWCTabsClock.now()) >= runtime.scrollMax - 0.5
        runtime.scrollMax = maxX
        if !runtime.initialScroll && w > 0 { runtime.initialScroll = true; runtime.scroll.snap([rtl ? maxX : 0]) }
        else if rtl && wasAtEnd { runtime.scroll.snap([maxX]) }
    }
    func bindController() { controller?.select = { i in let s = self.specs; if !standalone, s.indices.contains(i) { activate(i, s) } } }
    func clips(_ layout: (tabs: [AWCTabGeometry], content: Double, height: Double), width w: Double) -> (left: Bool, right: Bool) {
        guard let first = layout.tabs.first, let last = layout.tabs.last else { return (false, false) }
        let x = runtime.scrollX(AWCTabsClock.now())
        let left = min(first.x, last.x) - x, right = max(first.x + first.width, last.x + last.width) - x
        return (left < -1, right > w + 1)
    }
    @ViewBuilder func strip(_ specs: [AWCTabSpec], _ layout: (tabs: [AWCTabGeometry], content: Double, height: Double), _ states: [AWCTabState],
                            _ palette: AWCTabsPalette, width w: Double, fixedWidth: Double?, animating: Bool) -> some View {
        let overflow = layout.content > w + 0.5, clip = clips(layout, width: w)
        ZStack(alignment: .topLeading) {
            Rectangle().fill(standalone ? Color.clear : palette.host)
                // ::part(container): the scrolling strip's own background over the host's.
                .overlay { if let c = tabsPartAppearance.containerColor { Rectangle().fill(Color(awcHex: c)).awcInspect(nodeID: node.id, part: "container", name: "container") { _ in ["background": awcTabsRGBA(awcTabsComponents(Color(awcHex: c)))] } } }
            if full && !standalone {
                Rectangle().fill(palette.stripDivider).frame(height: 1)
                    .awcInspect(nodeID: node.id, part: "divider", name: "divider") { _ in ["color": awcTabsRGBA(awcTabsComponents(palette.stripDivider))] }
                    .frame(maxHeight: .infinity, alignment: .bottom)
            }
            // The strip scrolls itself (a hidden-scrollbar overflow-x: auto container): an offset the wheel, a drag and
            // the nearest-edge reveal drive, so the tabs stay in the host's layout and inspection tree.
            TimelineView(AWCTabsClock.schedule(paused: !animating)) { _ in
                let t = AWCTabsClock.now()
                row(specs, layout, states, palette, at: t).offset(x: -CGFloat(runtime.scrollX(t)))
            }
            .frame(width: CGFloat(w), height: CGFloat(layout.height), alignment: .topLeading)
            .clipped()
            .mask { fades(width: w, left: clip.left, right: clip.right) }
            .simultaneousGesture(DragGesture(minimumDistance: 8).onChanged { v in
                guard overflow else { return }
                let start = runtime.dragStart ?? runtime.scrollX(AWCTabsClock.now()); runtime.dragStart = start
                runtime.scroll(toLeft: start - Double(v.translation.width), animated: false)
            }.onEnded { _ in runtime.dragStart = nil })
            .background { AWCTabsWheel(enabled: overflow) { dx in runtime.scroll(toLeft: runtime.scrollX(AWCTabsClock.now()) + dx, animated: false) } }
        }
        .environment(\.layoutDirection, .leftToRight)
        .frame(width: fixedWidth.map { CGFloat($0) }, height: CGFloat(layout.height), alignment: .topLeading)
        .clipped()
        .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { viewport = $0 }
        .modifier(AWCTabsListAccessibility(id: node.id, label: label, enabled: !standalone))
        .awcInspect(nodeID: node.id, name: "md-tabs") { _ in
            ["activeTabIndex": .number(Double(runtime.index)), "activeID": runtime.activeID.map { .string($0) } ?? .null, "count": .number(Double(specs.count)),
             "scrollLeft": .number(rtl ? -(runtime.scrollMax - runtime.scrollX(AWCTabsClock.now())) : runtime.scrollX(AWCTabsClock.now())), "scrollWidth": .number(layout.content), "clientWidth": .number(w),
             "clipLeft": .bool(clip.left), "clipRight": .bool(clip.right), "label": .string(label), "variant": .string(primary ? "primary" : "secondary"),
             "divider": .string(full ? "full" : "auto"), "reduced": .bool(reduced), "host": awcTabsRGBA(awcTabsComponents(palette.host))]
        }
    }
    /// Edge fades over 40 points on each clipped side (physical geometry, so RTL-correct by construction).
    @ViewBuilder func fades(width w: Double, left: Bool, right: Bool) -> some View {
        if !left && !right || w <= 80 { Rectangle().fill(.black) }
        else {
            let e = 40 / w
            LinearGradient(stops: [.init(color: left ? .clear : .black, location: 0), .init(color: .black, location: e),
                                   .init(color: .black, location: 1 - e), .init(color: right ? .clear : .black, location: 1)],
                           startPoint: .leading, endPoint: .trailing)
        }
    }
    func row(_ specs: [AWCTabSpec], _ layout: (tabs: [AWCTabGeometry], content: Double, height: Double), _ states: [AWCTabState], _ palette: AWCTabsPalette, at t: Double) -> some View {
        let frames = layout.tabs.map { CGRect(x: $0.x, y: 0, width: $0.width, height: $0.height) }
        return AWCTabsRow(frames: frames, size: CGSize(width: layout.content, height: layout.height)) {
            ForEach(Array(specs.enumerated()), id: \.element.id) { i, s in
                tab(s, i, layout.tabs[i], states[i], palette, at: t)
                    // Laboratory inspection: a tab reports as part `tab-N` of the inspected tablist.
                    .environment(\.awcInspectionAlias, AWCInspectionAlias(childID: s.id, parentID: node.id, part: "tab-\(i)"))
            }
        }
    }
    func keyActivate(_ index: Int) {
        let specs = specs
        guard specs.indices.contains(index), !specs[index].disabled else { return }
        runtime.ripple(specs[index].id).trigger()
        click(index, specs)
    }
    @ViewBuilder func tab(_ s: AWCTabSpec, _ i: Int, _ g: AWCTabGeometry, _ st: AWCTabState, _ palette: AWCTabsPalette, at t: Double) -> some View {
        let m = runtime.motion(s.id), metrics = AWCTabMetrics(d: s.density(inherited: inheritedDensity))
        let color = m.color.value(t), iconColor = m.icon.value(t), layer = m.layer.value(t)[0]
        let host = awcTabsColor(color)
        let size = CGSize(width: g.width, height: g.height)
        ZStack(alignment: .topLeading) {
            // The surface takes the pointer (its parts let hits through), so the md-ripple wave starts under any point of the tab.
            Rectangle().fill(palette.container).contentShape(Rectangle())
                .modifier(AWCRippleSurface(disabled: s.disabled, hidden: false, cornerRadius: 0, contentColor: host, controller: runtime.ripple(s.id), local: nil, inspectNodeID: s.id + "-ripple"))
            let layerFill = partStyle(s.id).stateLayerColor.map { Color(awcHex: $0) } ?? host
            Rectangle().fill(layerFill).opacity(layer).allowsHitTesting(false)
                // (the md-ripple wave reports as node "<tab>-ripple")
                .awcInspect(nodeID: s.id, part: "state-layer", name: "state-layer") { _ in ["opacity": .number(layer), "color": awcTabsRGBA(awcTabsComponents(layerFill))] }
            parts(s, g, metrics, palette, m, host: host, icon: awcTabsColor(iconColor), at: t).allowsHitTesting(false)
            if st.focusVisible { Rectangle().strokeBorder(palette.focusRing, lineWidth: 3).allowsHitTesting(false) }
        }
        .frame(width: size.width, height: size.height, alignment: .topLeading)
        .contentShape(Rectangle())
        .onHover { h in if h { runtime.hoverID = s.id } else if runtime.hoverID == s.id { runtime.hoverID = nil } }
        .simultaneousGesture(DragGesture(minimumDistance: 0)
            .onChanged { _ in
                guard runtime.pressedID != s.id else { return }
                runtime.pressedID = s.id
                let h = runtime.handle(s.id); _ = (h.requestPointerFocus ?? h.requestFocus)?()
            }
            .onEnded { v in
                runtime.pressedID = nil
                if CGRect(origin: .zero, size: size).contains(v.location) { click(i, self.specs) }
            })
        .allowsHitTesting(!s.disabled)
        .onGeometryChange(for: CGRect.self) { $0.frame(in: .named("awc-native-preview")) } action: { runtime.frames[s.id] = $0 }
        .awcFocusBridgeLayer {
            AWCNativeButtonFocusBridge(configuration: AWCNativeFocusConfiguration(
                id: s.id, label: s.name,
                policy: AWCButtonAccessibilityPolicy(properties: ["roleOverride": .string("tab"), "selected": .bool(st.active), "disabled": .bool(s.disabled),
                                                                   "groupTabindex": .number(st.tabStop ? 0 : -1)]),
                group: nil, cell: nil, handle: runtime.handle(s.id), focusChanged: { _ in },
                activate: { keyActivate(i) }, routeKey: { k, _, _ in key(k, from: s.id) },
                controls: { [tabsID = node.id, controls = s.p["controls"]?.string ?? ""] in AWCTabPanelLinks.element(controls: controls, tabs: tabsID, index: i) }))
        }
        .awcInspect(nodeID: s.id, name: "md-tab") { _ in
            let ind = m.indicator.value(t)
            return ["active": .bool(st.active), "disabled": .bool(s.disabled), "tabStop": .bool(st.tabStop), "focused": .bool(st.focused),
                    "focusVisible": .bool(st.focusVisible), "hover": .bool(st.hover), "pressed": .bool(st.pressed), "color": awcTabsRGBA(color),
                    "iconColor": awcTabsRGBA(iconColor), "layerOpacity": .number(layer), "indicatorOpacity": .number(m.indicatorOpacity.value(t)[0]),
                    "indicatorTranslate": .number(ind[0]), "indicatorScale": .number(ind[1]), "indicatorColor": awcTabsRGBA(awcTabsComponents(palette.indicator)),
                    "renderTime": .number(t), "animating": .bool(m.running(t)), "kind": .string(g.kind), "name": .string(s.name), "container": awcTabsRGBA(awcTabsComponents(palette.container))]
        }
    }
    @ViewBuilder func parts(_ s: AWCTabSpec, _ g: AWCTabGeometry, _ metrics: AWCTabMetrics, _ palette: AWCTabsPalette, _ m: AWCTabMotion,
                           host: Color, icon: Color, at t: Double) -> some View {
        let ind = m.indicator.value(t), opacity = m.indicatorOpacity.value(t)[0]
        let r = primary ? min(Double(g.indicator.height), Double(g.indicator.width) / 2) : min(2, Double(g.indicator.height))
        let frames: [CGRect] = [g.divider, g.icon ?? .zero, g.labelText, g.badge ?? .zero, g.indicator, g.content, g.label ?? .zero]
        let ps = partStyle(s.id), labelInk = ps.labelColor.map { Color(awcHex: $0) } ?? host
        let dividerFill = ps.dividerColor.map { Color(awcHex: $0) } ?? palette.tabDivider, indicatorFill = ps.indicatorColor.map { Color(awcHex: $0) } ?? palette.indicator
        AWCTabParts(frames: frames, size: CGSize(width: g.width, height: g.height)) {
            Rectangle().fill(dividerFill)
                .awcInspect(nodeID: s.id, part: "divider", name: "divider") { _ in ["color": awcTabsRGBA(awcTabsComponents(dividerFill))] }
            Group {
                if g.icon != nil {
                    if let slot = s.slotIcon { renderChild(slot).foregroundStyle(ps.iconColor.map { Color(awcHex: $0) } ?? host) }
                    else { Text(s.icon).font(AWCNativeFonts.symbol(size: CGFloat(metrics.icon))).foregroundStyle(icon).fixedSize() }
                } else { Color.clear }
            }
            .awcInspect(nodeID: s.id, part: "icon", name: "icon") { _ in ["color": awcTabsRGBA(awcTabsComponents(icon)), "size": .number(metrics.icon)] }
            AWCTabLabelBox(measured: AWCNativeFonts.tabTextWidth(s.label, size: CGFloat(metrics.labelSize))) {
                Text(s.label).font(AWCNativeFonts.label(size: CGFloat(metrics.labelSize), weight: 500)).tracking(0.1).lineLimit(1).truncationMode(.tail)
                    .foregroundStyle(labelInk)
            }
            .awcInspect(nodeID: s.id, part: "label-text", name: "label-text") { _ in ["color": awcTabsRGBA(awcTabsComponents(labelInk)), "fontSize": .number(metrics.labelSize)] }
            badge(s, palette)
            UnevenRoundedRectangle(topLeadingRadius: r, bottomLeadingRadius: 0, bottomTrailingRadius: 0, topTrailingRadius: r, style: .circular)
                .fill(indicatorFill)
                // Bounds are the rendered box (scale about the centre, then the translate), as getBoundingClientRect reports it.
                .awcInspect(nodeID: s.id, part: "indicator", name: "indicator") { _ in
                    ["opacity": .number(opacity), "translate": .number(ind[0]), "scale": .number(ind[1]), "color": awcTabsRGBA(awcTabsComponents(indicatorFill))]
                }
                .scaleEffect(x: ind[1], y: 1, anchor: .center).offset(x: ind[0]).opacity(opacity)
            Color.clear.awcInspect(nodeID: s.id, part: "content", name: "content") { _ in [:] }
            Color.clear.awcInspect(nodeID: s.id, part: "label", name: "label") { _ in ["color": awcTabsRGBA(awcTabsComponents(labelInk))] }
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
    @ViewBuilder func badge(_ s: AWCTabSpec, _ palette: AWCTabsPalette) -> some View {
        if let slot = s.slotBadge {
            renderChild(slot).fixedSize()
                .onGeometryChange(for: Double.self) { Double($0.size.width) } action: { w in if runtime.slotWidths[slot.id] != w { runtime.slotWidths[slot.id] = w } }
        } else if let text = s.badge {
            ZStack {
                Capsule().fill(palette.badge)
                if !text.isEmpty { Text(text).font(AWCNativeFonts.label(size: 10, weight: 500)).foregroundStyle(palette.onBadge).fixedSize() }
            }
            .awcInspect(nodeID: s.id, part: "badge", name: "badge") { _ in ["text": .string(text), "color": awcTabsRGBA(awcTabsComponents(palette.badge))] }
        } else { Color.clear }
    }
}

/// The tablist container: macOS an AXTabGroup element that lists the tabs; iOS a labelled container of tabs.
struct AWCTabsListAccessibility: ViewModifier {
    let id: String, label: String, enabled: Bool
    @ViewBuilder func body(content: Content) -> some View {
        if !enabled { content } else {
        #if canImport(AppKit)
        content.accessibilityHidden(true).background { AWCNativeContainerAccessibilityBridge(role: "AXTabGroup", label: label, identifier: id, level: 0, members: .all) }
        #else
        content.accessibilityElement(children: .contain).accessibilityLabel(label).accessibilityIdentifier(id)
        #endif
        }
    }
}

// MARK: - Panels

/// md-tab-panels: follows the md-tabs named by `for` (or the nearest preceding md-tabs sibling) through the shared
/// interaction store, which md-tabs updates on every path (user, selectTab, activeTabIndex writes, reconciliation).
/// `stable` stacks every panel in one cell (the region keeps the largest box; inactive panels keep their layout but are
/// not painted, hit or exposed); `active` lays out the active panel only.
struct AWCNativeTabPanels: View {
    let node: AWCNode
    let properties: [String: AWCValue]
    let store: AWCInteractionStore
    let renderChild: (AWCNode, [String: AWCValue]) -> AnyView
    @Environment(\.awcPrecedingTabsID) private var precedingTabsID
    var tabsID: String? { let f = properties["for"]?.string ?? ""; return f.isEmpty ? precedingTabsID : f }
    var body: some View {
        let panels = node.children.filter { $0.tag == "md-tab-panel" }, id = tabsID
        let index = id.flatMap { store.tabIndices[$0] } ?? 0
        let labels = id.flatMap { store.tabLabels[$0] } ?? []
        let activeOnly = properties["sizing"]?.string == "active"
        ZStack(alignment: .topLeading) {
            ForEach(Array(panels.enumerated()), id: \.element.id) { i, panel in
                if !activeOnly || i == index {
                    renderChild(panel, ["active": .bool(i == index), "_panelLabel": .string(i < labels.count ? labels[i] : ""), "_panelTabs": .string(id ?? ""), "_panelIndex": .number(Double(i))])
                        .environment(\.awcInspectionAlias, AWCInspectionAlias(childID: panel.id, parentID: node.id, part: "panel-\(i)"))
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .topLeading)
        .awcInspect(nodeID: node.id, name: "md-tab-panels") { _ in
            ["index": .number(Double(index)), "for": .string(id ?? ""), "sizing": .string(activeOnly ? "active" : "stable"), "count": .number(Double(panels.count))]
        }
    }
}

extension AWCNativeView {
    func emitTabs(_ name: String, _ id: String, _ tag: String, _ detail: AWCValue) {
        onEvent(AWCEventDispatcher.dispatch(AWCEvent(name: name, tag: tag, nodeID: id, detail: detail), through: eventDispatcher, cancelable: true, targetListeners: eventTargetListeners).observedEvent)
    }
    /// md-tabs: the dedicated tablist renderer (its md-tab children are managed by it).
    @ViewBuilder var nativeTabs: some View {
        let properties = node.properties.merging(local) { _, l in l }
        AWCNativeTabs(node: node, properties: properties, theme: theme, inheritedDensity: inheritedDensity, store: interactionStore,
                      emit: { emitTabs($0, $1, $2, $3) }, setIndexProperty: { set("activeTabIndex", .number(Double($0))) }, renderChild: { child($0) })
    }
    /// A tab outside a tablist: its own `active`, tab stop and divider segment; activation emits mdTabClick only.
    @ViewBuilder var nativeTab: some View {
        let properties = node.properties.merging(local) { _, l in l }
        let tab = AWCNode(id: node.id, tag: node.tag, properties: properties, children: node.children)
        let list = AWCNode(id: node.id + "\u{0}tablist", tag: "md-tabs", properties: ["variant": properties["variant"] ?? .string("primary"), "_standalone": .bool(true),
                                                                                      "divider": .string("auto"), "tabWidth": .string("auto")], children: [tab])
        AWCNativeTabs(node: list, properties: list.properties, theme: theme, inheritedDensity: inheritedDensity, store: interactionStore,
                      emit: { emitTabs($0, $1, $2, $3) }, setIndexProperty: { _ in }, renderChild: { child($0) })
    }
    @ViewBuilder var nativeTabPanels: some View {
        AWCNativeTabPanels(node: node, properties: node.properties.merging(local) { _, l in l }, store: interactionStore, renderChild: { child($0, properties: $1) })
    }
    /// md-tab-panel: role tabpanel named by its tab; an inactive panel keeps its box but is not painted, hit or exposed.
    @ViewBuilder var nativeTabPanel: some View {
        // The region passes `active` / the tab name down as node properties on every render (`local` is the first render's copy).
        let active = node.properties["active"]?.bool ?? false, name = node.properties["_panelLabel"]?.string ?? ""
        AWCNativeTabPanelSurface(nodeID: node.id, active: active, name: name, tabs: node.properties["_panelTabs"]?.string ?? "",
                                 index: Int(node.properties["_panelIndex"]?.number ?? -1), ring: theme.primary) { content() }
    }
}

/// md-tab-panel's surface: the active panel is a sequential focus stop (source `tabindex` 0 / inactive -1) with the source
/// `:host(:focus-visible)` ring (3 px primary outline, 2 px offset, 4 px radius); keyboard focus shows it, pointer focus does not
/// reach a panel (gate-7 R6-08). The SwiftUI group around it is the panel's accessibility element (named by its tab); the
/// surface registers itself so the tab can link to that element (R6-09).
struct AWCNativeTabPanelSurface<Content: View>: View {
    let nodeID: String, active: Bool, name: String, tabs: String, index: Int, ring: Color
    @ViewBuilder let content: () -> Content
    @State private var focus = AWCButtonFocusHandle()
    var body: some View {
        let visible = active && focus.isFocusVisible
        content()
            .frame(maxWidth: .infinity, alignment: .topLeading)
            .opacity(active ? 1 : 0)
            .allowsHitTesting(active)
            .awcFocusBridgeLayer {
                AWCNativeButtonFocusBridge(configuration: AWCNativeFocusConfiguration(
                    id: nodeID, label: name,
                    policy: AWCButtonAccessibilityPolicy(properties: ["roleOverride": .string("tabpanel"), "disabled": .bool(!active)]),
                    group: nil, cell: nil, handle: focus, focusChanged: { _ in }, activate: {},
                    registerView: { [nodeID, name, tabs, index] view in AWCTabPanelLinks.register(view, id: nodeID, name: name, tabs: tabs.isEmpty ? nil : tabs, index: index) }))
            }
            .overlay {
                // outline: 3px solid primary; outline-offset: 2px; border-radius: 4px (the outline follows the radius + offset).
                RoundedRectangle(cornerRadius: 4 + 2 + 1.5, style: .circular).inset(by: -3.5).stroke(ring, lineWidth: 3)
                    .opacity(visible ? 1 : 0).allowsHitTesting(false).accessibilityHidden(true)
            }
            .accessibilityElement(children: .contain)
            .accessibilityLabel(name)
            .accessibilityHidden(!active)
            .awcInspect(nodeID: nodeID, name: "md-tab-panel") { _ in ["active": .bool(active), "label": .string(name), "tabStop": .bool(active),
                                                                         "focused": .bool(focus.isFocused), "focusVisible": .bool(visible)] }
    }
}

/// md-tab ↔ md-tab-panel accessibility relation (Web aria-controls, set by the source or by md-tab-panels' auto-wiring): a panel
/// registers its focus surface by node id and by (md-tabs id, index); a tab links to the element around that surface, the
/// panel's SwiftUI group (macOS AXLinkedUIElements). UIKit and Compose have no element relation (exception record R6-09).
enum AWCTabPanelLinks {
    final class Box { weak var view: AnyObject?; let name: String; init(_ view: AnyObject, _ name: String) { self.view = view; self.name = name } }
    nonisolated(unsafe) static var byID: [String: Box] = [:]
    nonisolated(unsafe) static var byTabs: [String: [Int: Box]] = [:]
    static func register(_ view: AnyObject, id: String, name: String, tabs: String?, index: Int) {
        byID[id] = Box(view, name); if let tabs, index >= 0 { byTabs[tabs, default: [:]][index] = Box(view, name) }
    }
    /// The panel's element: the nearest accessibility ancestor of its focus surface named like the panel (its SwiftUI group).
    static func element(controls: String, tabs: String, index: Int) -> AnyObject? {
        guard let box = controls.isEmpty ? byTabs[tabs]?[index] : byID[controls], let view = box.view else { return nil }
        #if canImport(AppKit)
        // The SwiftUI group around the surface is not among the surface's accessibility ancestors: search the window's tree
        // (breadth first) for the group named like the panel whose frame holds the surface.
        guard let surface = view as? NSView, let window = surface.window, let root = window.contentView, !box.name.isEmpty else { return nil }
        let r = window.convertToScreen(surface.convert(surface.bounds, to: nil)), mid = CGPoint(x: r.midX, y: r.midY)
        var queue: [Any] = root.accessibilityChildren() ?? [], visited = 0
        while !queue.isEmpty, visited < 5000 {
            let item = queue.removeFirst(); visited += 1
            guard let e = item as? NSAccessibilityProtocol else { continue }
            if e.accessibilityRole() == .group, e.accessibilityLabel() == box.name, e.accessibilityFrame().insetBy(dx: -1, dy: -1).contains(mid) { return item as AnyObject }
            queue.append(contentsOf: e.accessibilityChildren() ?? [])
        }
        return nil
        #else
        return nil
        #endif
    }
}

/// Wheel input for a scrolled strip: a vertical wheel scrolls horizontally (instant), horizontal gestures natively.
/// macOS: a local event monitor scoped to the strip's bounds (SwiftUI on macOS 14 has no wheel modifier); iOS: no wheel.
struct AWCTabsWheel: View {
    let enabled: Bool, scrollBy: (Double) -> Void
    var body: some View {
        #if canImport(AppKit)
        AWCTabsWheelBridge(enabled: enabled, scrollBy: scrollBy).allowsHitTesting(false).accessibilityHidden(true)
        #else
        Color.clear.allowsHitTesting(false)
        #endif
    }
}
#if canImport(AppKit)
final class AWCTabsWheelView: NSView {
    var enabled = false, scrollBy: (Double) -> Void = { _ in }
    private var monitor: Any?
    override func hitTest(_ point: NSPoint) -> NSView? { nil }
    override func viewDidMoveToWindow() {
        super.viewDidMoveToWindow()
        if let monitor { NSEvent.removeMonitor(monitor); self.monitor = nil }
        guard window != nil else { return }
        monitor = NSEvent.addLocalMonitorForEvents(matching: .scrollWheel) { [weak self] e in
            guard let self, self.enabled, e.window === self.window else { return e }
            let p = self.convert(e.locationInWindow, from: nil)
            guard self.bounds.contains(p) else { return e }
            let dx = abs(e.scrollingDeltaX) >= abs(e.scrollingDeltaY) ? -e.scrollingDeltaX : -e.scrollingDeltaY
            guard dx != 0 else { return e }
            self.scrollBy(Double(dx) * (e.hasPreciseScrollingDeltas ? 1 : 16)); return nil
        }
    }
    deinit { if let monitor { NSEvent.removeMonitor(monitor) } }
}
struct AWCTabsWheelBridge: NSViewRepresentable {
    let enabled: Bool, scrollBy: (Double) -> Void
    func makeNSView(context: Context) -> AWCTabsWheelView { AWCTabsWheelView() }
    func updateNSView(_ view: AWCTabsWheelView, context: Context) { view.enabled = enabled; view.scrollBy = scrollBy }
}
#endif
