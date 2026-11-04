import SwiftUI
import Observation
import CoreText

// MARK: - Hooks

/// md-navigation-tab's public hooks (`--md-navigation-tab-*`, the source stylesheet's documented list). Colours are
/// `#RRGGBB(AA)`, lengths points, the indicator shape one corner radius (9999 = full), opacities 0…1. `labelFont` is the
/// CSS `font` shorthand (its weight is the inactive weight, its line height the label line; the size always comes from
/// `labelFontSize`); `slottedIconFont` is the font family of text slotted as an icon. Unset hooks keep the source defaults.
public struct AWCNavigationTabAppearance: Equatable, Sendable {
    public let activeIndicatorColor: String?, activeIndicatorWidth: Double?, activeIndicatorHeight: Double?, activeIndicatorShape: Double?
    public let activeIconColor: String?, inactiveIconColor: String?, activeLabelColor: String?, inactiveLabelColor: String?
    public let labelFont: String?, labelFontSize: Double?, labelFontWeight: Double?, iconSize: Double?
    public let paddingBlockStart: Double?, paddingBlockEnd: Double?
    public let hoverStateLayerColor: String?, focusStateLayerColor: String?, pressedStateLayerColor: String?, focusStateLayerOpacity: Double?
    public let badgeColor: String?, badgeOnColor: String?, disabledOpacity: Double?, slottedIconFont: String?
    public init(activeIndicatorColor: String? = nil, activeIndicatorWidth: Double? = nil, activeIndicatorHeight: Double? = nil, activeIndicatorShape: Double? = nil,
                activeIconColor: String? = nil, inactiveIconColor: String? = nil, activeLabelColor: String? = nil, inactiveLabelColor: String? = nil,
                labelFont: String? = nil, labelFontSize: Double? = nil, labelFontWeight: Double? = nil, iconSize: Double? = nil,
                paddingBlockStart: Double? = nil, paddingBlockEnd: Double? = nil,
                hoverStateLayerColor: String? = nil, focusStateLayerColor: String? = nil, pressedStateLayerColor: String? = nil, focusStateLayerOpacity: Double? = nil,
                badgeColor: String? = nil, badgeOnColor: String? = nil, disabledOpacity: Double? = nil, slottedIconFont: String? = nil) {
        func len(_ v: Double?) -> Double? { v.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil } }
        func unit(_ v: Double?) -> Double? { v.flatMap { $0.isFinite ? min(1, max(0, $0)) : nil } }
        func text(_ v: String?) -> String? { v.map { $0.trimmingCharacters(in: .whitespaces) }.flatMap { $0.isEmpty ? nil : $0 } }
        self.activeIndicatorColor = awcSwitchColor(activeIndicatorColor); self.activeIndicatorWidth = len(activeIndicatorWidth)
        self.activeIndicatorHeight = len(activeIndicatorHeight); self.activeIndicatorShape = len(activeIndicatorShape)
        self.activeIconColor = awcSwitchColor(activeIconColor); self.inactiveIconColor = awcSwitchColor(inactiveIconColor)
        self.activeLabelColor = awcSwitchColor(activeLabelColor); self.inactiveLabelColor = awcSwitchColor(inactiveLabelColor)
        self.labelFont = text(labelFont); self.labelFontSize = len(labelFontSize)
        self.labelFontWeight = labelFontWeight.flatMap { $0.isFinite && $0 >= 1 && $0 <= 1000 ? $0 : nil }; self.iconSize = len(iconSize)
        self.paddingBlockStart = paddingBlockStart.flatMap { $0.isFinite ? $0 : nil }; self.paddingBlockEnd = paddingBlockEnd.flatMap { $0.isFinite ? $0 : nil }
        self.hoverStateLayerColor = awcSwitchColor(hoverStateLayerColor); self.focusStateLayerColor = awcSwitchColor(focusStateLayerColor)
        self.pressedStateLayerColor = awcSwitchColor(pressedStateLayerColor); self.focusStateLayerOpacity = unit(focusStateLayerOpacity)
        self.badgeColor = awcSwitchColor(badgeColor); self.badgeOnColor = awcSwitchColor(badgeOnColor)
        self.disabledOpacity = unit(disabledOpacity); self.slottedIconFont = text(slottedIconFont)
    }
    /// Laboratory names (the CSS hook without `--md-navigation-tab-`, camel-cased).
    public init(values: [String: AWCValue]) {
        func s(_ k: String) -> String? { values[k]?.string }
        func n(_ k: String) -> Double? { values[k]?.number }
        self.init(activeIndicatorColor: s("activeIndicatorColor"), activeIndicatorWidth: n("activeIndicatorWidth"), activeIndicatorHeight: n("activeIndicatorHeight"),
                  activeIndicatorShape: n("activeIndicatorShape"), activeIconColor: s("activeIconColor"), inactiveIconColor: s("inactiveIconColor"),
                  activeLabelColor: s("activeLabelColor"), inactiveLabelColor: s("inactiveLabelColor"), labelFont: s("labelFont"), labelFontSize: n("labelFontSize"),
                  labelFontWeight: n("labelFontWeight"), iconSize: n("iconSize"), paddingBlockStart: n("paddingBlockStart"), paddingBlockEnd: n("paddingBlockEnd"),
                  hoverStateLayerColor: s("hoverStateLayerColor"), focusStateLayerColor: s("focusStateLayerColor"), pressedStateLayerColor: s("pressedStateLayerColor"),
                  focusStateLayerOpacity: n("focusStateLayerOpacity"), badgeColor: s("badgeColor"), badgeOnColor: s("badgeOnColor"),
                  disabledOpacity: n("disabledOpacity"), slottedIconFont: s("slottedIconFont"))
    }
    public func merging(_ o: Self) -> Self {
        .init(activeIndicatorColor: o.activeIndicatorColor ?? activeIndicatorColor, activeIndicatorWidth: o.activeIndicatorWidth ?? activeIndicatorWidth,
              activeIndicatorHeight: o.activeIndicatorHeight ?? activeIndicatorHeight, activeIndicatorShape: o.activeIndicatorShape ?? activeIndicatorShape,
              activeIconColor: o.activeIconColor ?? activeIconColor, inactiveIconColor: o.inactiveIconColor ?? inactiveIconColor,
              activeLabelColor: o.activeLabelColor ?? activeLabelColor, inactiveLabelColor: o.inactiveLabelColor ?? inactiveLabelColor,
              labelFont: o.labelFont ?? labelFont, labelFontSize: o.labelFontSize ?? labelFontSize, labelFontWeight: o.labelFontWeight ?? labelFontWeight,
              iconSize: o.iconSize ?? iconSize, paddingBlockStart: o.paddingBlockStart ?? paddingBlockStart, paddingBlockEnd: o.paddingBlockEnd ?? paddingBlockEnd,
              hoverStateLayerColor: o.hoverStateLayerColor ?? hoverStateLayerColor, focusStateLayerColor: o.focusStateLayerColor ?? focusStateLayerColor,
              pressedStateLayerColor: o.pressedStateLayerColor ?? pressedStateLayerColor, focusStateLayerOpacity: o.focusStateLayerOpacity ?? focusStateLayerOpacity,
              badgeColor: o.badgeColor ?? badgeColor, badgeOnColor: o.badgeOnColor ?? badgeOnColor, disabledOpacity: o.disabledOpacity ?? disabledOpacity,
              slottedIconFont: o.slottedIconFont ?? slottedIconFont)
    }
    /// The `font` shorthand's weight and line height (`[style] [weight] size[/line-height] family`).
    var shorthand: (weight: Double?, lineHeight: Double?) {
        guard let f = labelFont else { return (nil, nil) }
        var weight: Double?, line: Double?
        for token in f.split(whereSeparator: { $0 == " " }).map(String.init) {
            if let w = Double(token), w >= 1, w <= 1000, weight == nil { weight = w; continue }
            if token == "bold" { weight = 700 } else if token == "normal", weight == nil { weight = 400 }
            if token.contains("/") { let parts = token.split(separator: "/"); if parts.count == 2 { line = Double(parts[1].replacingOccurrences(of: "px", with: "")) } }
        }
        return (weight, line)
    }
}

/// md-navigation-bar's seven hooks (`--md-navigation-bar-*`) plus the md-navigation-tab hooks set on the bar, which
/// every tab inherits (custom properties inherit through the tabs' shadow roots). Corners are the CSS border-radius
/// corners, the elevation the CSS box-shadow layers.
public struct AWCNavigationBarAppearance: Equatable, Sendable {
    public let containerColor: String?, containerHeight: Double?, containerShape: AWCCornerShape?, containerElevation: [AWCBoxShadow]?
    public let dividerColor: String?, dividerWidth: Double?, zIndex: Double?
    public let tab: AWCNavigationTabAppearance
    public init(containerColor: String? = nil, containerHeight: Double? = nil, containerShape: AWCCornerShape? = nil, containerElevation: [AWCBoxShadow]? = nil,
                dividerColor: String? = nil, dividerWidth: Double? = nil, zIndex: Double? = nil, tab: AWCNavigationTabAppearance) {
        self.containerColor = awcSwitchColor(containerColor); self.containerHeight = containerHeight.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.containerShape = containerShape; self.containerElevation = containerElevation
        self.dividerColor = awcSwitchColor(dividerColor); self.dividerWidth = dividerWidth.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.zIndex = zIndex.flatMap { $0.isFinite && abs($0) < 1e9 ? $0.rounded(.towardZero) : nil }; self.tab = tab
    }
    public init(containerColor: String? = nil, containerHeight: Double? = nil, containerShape: AWCCornerShape? = nil, containerElevation: [AWCBoxShadow]? = nil,
                dividerColor: String? = nil, dividerWidth: Double? = nil, zIndex: Double? = nil,
                activeIndicatorColor: String? = nil, activeIndicatorWidth: Double? = nil, activeIndicatorHeight: Double? = nil, activeIndicatorShape: Double? = nil,
                activeIconColor: String? = nil, inactiveIconColor: String? = nil, activeLabelColor: String? = nil, inactiveLabelColor: String? = nil,
                labelFont: String? = nil, labelFontSize: Double? = nil, labelFontWeight: Double? = nil, iconSize: Double? = nil,
                paddingBlockStart: Double? = nil, paddingBlockEnd: Double? = nil,
                hoverStateLayerColor: String? = nil, focusStateLayerColor: String? = nil, pressedStateLayerColor: String? = nil, focusStateLayerOpacity: Double? = nil,
                badgeColor: String? = nil, badgeOnColor: String? = nil, disabledOpacity: Double? = nil, slottedIconFont: String? = nil) {
        self.init(containerColor: containerColor, containerHeight: containerHeight, containerShape: containerShape, containerElevation: containerElevation,
                  dividerColor: dividerColor, dividerWidth: dividerWidth, zIndex: zIndex,
                  tab: AWCNavigationTabAppearance(activeIndicatorColor: activeIndicatorColor, activeIndicatorWidth: activeIndicatorWidth, activeIndicatorHeight: activeIndicatorHeight,
                                                  activeIndicatorShape: activeIndicatorShape, activeIconColor: activeIconColor, inactiveIconColor: inactiveIconColor,
                                                  activeLabelColor: activeLabelColor, inactiveLabelColor: inactiveLabelColor, labelFont: labelFont, labelFontSize: labelFontSize,
                                                  labelFontWeight: labelFontWeight, iconSize: iconSize, paddingBlockStart: paddingBlockStart, paddingBlockEnd: paddingBlockEnd,
                                                  hoverStateLayerColor: hoverStateLayerColor, focusStateLayerColor: focusStateLayerColor, pressedStateLayerColor: pressedStateLayerColor,
                                                  focusStateLayerOpacity: focusStateLayerOpacity, badgeColor: badgeColor, badgeOnColor: badgeOnColor,
                                                  disabledOpacity: disabledOpacity, slottedIconFont: slottedIconFont))
    }
    /// Laboratory names: the bar hooks plus every md-navigation-tab hook (inherited by the tabs).
    public init(values: [String: AWCValue]) {
        let shape: AWCCornerShape? = { if case .object(let o)? = values["containerShape"] { return AWCCornerShape(values: o) }; return nil }()
        let elevation: [AWCBoxShadow]? = { if case .array(let a)? = values["containerElevation"] {
            let layers = a.compactMap { v -> AWCBoxShadow? in if case .object(let o) = v { return AWCBoxShadow(values: o) }; return nil }
            return layers.count == a.count ? layers : nil }; return nil }()
        self.init(containerColor: values["containerColor"]?.string, containerHeight: values["containerHeight"]?.number, containerShape: shape, containerElevation: elevation,
                  dividerColor: values["dividerColor"]?.string, dividerWidth: values["dividerWidth"]?.number, zIndex: values["zIndex"]?.number,
                  tab: AWCNavigationTabAppearance(values: values))
    }
    public func merging(_ o: Self) -> Self {
        .init(containerColor: o.containerColor ?? containerColor, containerHeight: o.containerHeight ?? containerHeight, containerShape: o.containerShape ?? containerShape,
              containerElevation: o.containerElevation ?? containerElevation, dividerColor: o.dividerColor ?? dividerColor, dividerWidth: o.dividerWidth ?? dividerWidth,
              zIndex: o.zIndex ?? zIndex, tab: tab.merging(o.tab))
    }
    /// The CSS `border-radius` shorthand in px (one to four corners, no elliptical radii).
    public static func corners(css: String) -> AWCCornerShape? {
        let v = css.split(whereSeparator: { $0 == " " }).compactMap { Double($0.replacingOccurrences(of: "px", with: "")) }
        guard (1...4).contains(v.count), v.allSatisfy({ $0.isFinite && $0 >= 0 }) else { return nil }
        let tl = v[0], tr = v.count > 1 ? v[1] : v[0], br = v.count > 2 ? v[2] : v[0], bl = v.count > 3 ? v[3] : (v.count > 1 ? v[1] : v[0])
        return AWCCornerShape(topLeft: .init(.points(tl)), topRight: .init(.points(tr)), bottomRight: .init(.points(br)), bottomLeft: .init(.points(bl)))
    }
    /// Source hook text (`--md-navigation-bar-*` / `--md-navigation-tab-*` → value) as the paint fixtures author it.
    public init(css: [String: String]) {
        func s(_ k: String) -> String? { css[k] }
        func n(_ k: String) -> Double? { css[k].flatMap { Double($0.replacingOccurrences(of: "px", with: "").replacingOccurrences(of: "ms", with: "").trimmingCharacters(in: .whitespaces)) } }
        let b = "--md-navigation-bar-", t = "--md-navigation-tab-"
        self.init(containerColor: s(b + "container-color"), containerHeight: n(b + "container-height"), containerShape: s(b + "container-shape").flatMap(Self.corners(css:)),
                  containerElevation: s(b + "container-elevation").flatMap { AWCBoxShadow.source($0) }, dividerColor: s(b + "divider-color"), dividerWidth: n(b + "divider-width"),
                  zIndex: n(b + "z-index"), activeIndicatorColor: s(t + "active-indicator-color"), activeIndicatorWidth: n(t + "active-indicator-width"),
                  activeIndicatorHeight: n(t + "active-indicator-height"), activeIndicatorShape: n(t + "active-indicator-shape"), activeIconColor: s(t + "active-icon-color"),
                  inactiveIconColor: s(t + "inactive-icon-color"), activeLabelColor: s(t + "active-label-color"), inactiveLabelColor: s(t + "inactive-label-color"),
                  labelFont: s(t + "label-font"), labelFontSize: n(t + "label-font-size"), labelFontWeight: n(t + "label-font-weight"), iconSize: n(t + "icon-size"),
                  paddingBlockStart: n(t + "padding-block-start"), paddingBlockEnd: n(t + "padding-block-end"), hoverStateLayerColor: s(t + "hover-state-layer-color"),
                  focusStateLayerColor: s(t + "focus-state-layer-color"), pressedStateLayerColor: s(t + "pressed-state-layer-color"),
                  focusStateLayerOpacity: n(t + "focus-state-layer-opacity"), badgeColor: s(t + "badge-color"), badgeOnColor: s(t + "badge-on-color"),
                  disabledOpacity: n(t + "disabled-opacity"), slottedIconFont: s(t + "slotted-icon-font"))
    }
}

/// md-navigation-bar's methods: `select(index)` clamps to an enabled destination and emits mdChange when the selection
/// changes; `focusTab(index)` moves keyboard focus to a destination (not a hard-disabled one) without selecting it.
@MainActor @Observable public final class AWCNavigationBarController {
    @ObservationIgnored var selectHandler: ((Int) -> Void)?
    @ObservationIgnored var focusHandler: ((Int) -> Void)?
    nonisolated public init() {}
    public func select(_ index: Int) { selectHandler?(index) }
    public func focusTab(_ index: Int) { focusHandler?(index) }
}

/// md-navigation-tab's `focusEl()` for a destination outside a bar (inside a bar use the bar's `focusTab(index)`).
@MainActor @Observable public final class AWCNavigationTabController {
    @ObservationIgnored var focusHandler: (() -> Void)?
    nonisolated public init() {}
    /// Focuses the destination unless it is hard-disabled.
    public func focusEl() { focusHandler?() }
}
private struct AWCNavigationTabControllerKey: EnvironmentKey { static let defaultValue: AWCNavigationTabController? = nil }
private struct AWCNavigationBarAppearanceKey: EnvironmentKey { static let defaultValue = AWCNavigationBarAppearance(tab: .init()) }
private struct AWCNavigationTabAppearanceKey: EnvironmentKey { static let defaultValue = AWCNavigationTabAppearance() }
private struct AWCNavigationBarControllerKey: EnvironmentKey { static let defaultValue: AWCNavigationBarController? = nil }
private struct AWCNavigationBarReducedMotionKey: EnvironmentKey { static let defaultValue: Bool? = nil }
public extension EnvironmentValues {
    var awcNavigationBarAppearance: AWCNavigationBarAppearance { get { self[AWCNavigationBarAppearanceKey.self] } set { self[AWCNavigationBarAppearanceKey.self] = newValue } }
    var awcNavigationTabAppearance: AWCNavigationTabAppearance { get { self[AWCNavigationTabAppearanceKey.self] } set { self[AWCNavigationTabAppearanceKey.self] = newValue } }
    var awcNavigationTabController: AWCNavigationTabController? { get { self[AWCNavigationTabControllerKey.self] } set { self[AWCNavigationTabControllerKey.self] = newValue } }
    var awcNavigationBarController: AWCNavigationBarController? { get { self[AWCNavigationBarControllerKey.self] } set { self[AWCNavigationBarControllerKey.self] = newValue } }
    /// Overrides the system Reduce Motion setting for the navigation bar (nil follows the system).
    var awcNavigationBarReducedMotion: Bool? { get { self[AWCNavigationBarReducedMotionKey.self] } set { self[AWCNavigationBarReducedMotionKey.self] = newValue } }
}
private struct AWCNavigationBarAppearanceModifier: ViewModifier {
    let value: AWCNavigationBarAppearance
    @Environment(\.awcNavigationBarAppearance) private var inherited
    func body(content: Content) -> some View { content.environment(\.awcNavigationBarAppearance, inherited.merging(value)) }
}
private struct AWCNavigationTabAppearanceModifier: ViewModifier {
    let value: AWCNavigationTabAppearance
    @Environment(\.awcNavigationTabAppearance) private var inherited
    func body(content: Content) -> some View { content.environment(\.awcNavigationTabAppearance, inherited.merging(value)) }
}
public extension View {
    func awcNavigationBarAppearance(_ value: AWCNavigationBarAppearance) -> some View { modifier(AWCNavigationBarAppearanceModifier(value: value)) }
    func awcNavigationTabAppearance(_ value: AWCNavigationTabAppearance) -> some View { modifier(AWCNavigationTabAppearanceModifier(value: value)) }
    func awcNavigationBarController(_ controller: AWCNavigationBarController) -> some View { environment(\.awcNavigationBarController, controller) }
    func awcNavigationTabController(_ controller: AWCNavigationTabController) -> some View { environment(\.awcNavigationTabController, controller) }
}

// MARK: - Model

/// The source CSS `ease` timing function (state layer, label colour and opacity, indicator opacity).
extension AWCTabsCurve { static let ease = AWCTabsCurve(x1: 0.25, y1: 0.1, x2: 0.25, y2: 1) }

/// One md-navigation-tab as the bar sees it.
struct AWCNavigationTabSpec {
    let node: AWCNode
    var id: String { node.id }
    var p: [String: AWCValue] { node.properties }
    var label: String { p["label"]?.string ?? "" }
    var icon: String { p["icon"]?.string ?? "" }
    var activeIcon: String { p["activeIcon"]?.string ?? "" }
    var slotIcon: AWCNode? { node.children.first { $0.slot == "icon" } }
    var slotActiveIcon: AWCNode? { node.children.first { $0.slot == "active-icon" } }
    /// Default-slot content replaces the label text (the slot's fallback is `label`).
    var slotLabel: [AWCNode] { node.children.filter { $0.slot == nil || $0.slot == "" } }
    var labelText: String {
        let slotted = slotLabel.map(\.authoredTextContent).joined().trimmingCharacters(in: .whitespacesAndNewlines)
        return slotLabel.isEmpty ? label : slotted
    }
    var hardDisabled: Bool { p["disabled"]?.bool == true }
    var softDisabled: Bool { p["softDisabled"]?.bool == true }
    /// Activation blocked (hard or soft); only hard-disabled tabs leave the arrow-key tour.
    var disabled: Bool { hardDisabled || softDisabled }
    /// The tab's own label behaviour (an explicit per-tab value wins over the bar's).
    var ownLabelBehavior: String? { p["labelBehavior"]?.string }
    /// nil: no badge; "": a small dot; text: a large badge (numeric values above `badgeMax` > 0 read "max+").
    var badge: String? {
        let raw: String = { if case .number(let n)? = p["badgeValue"] { return n == n.rounded() ? String(Int(n)) : String(n) }; return p["badgeValue"]?.string ?? "" }()
        guard p["badge"]?.bool == true || !raw.isEmpty else { return nil }
        let value = raw.trimmingCharacters(in: .whitespaces)
        guard !value.isEmpty else { return "" }
        let max = p["badgeMax"]?.number ?? 999
        if max > 0, let n = Double(value), n.isFinite, n > max { return "\(max == max.rounded() ? String(Int(max)) : String(max))+" }
        return value
    }
    /// Web accessible name: aria-label (the label in icon-only mode), else the badge's "N new" / "New" and the label text.
    func name(behavior: String) -> String {
        if let a = p["aria-label"]?.string, !a.isEmpty { return a }
        if behavior == "none" { return label }
        let b = badge.map { $0.isEmpty ? "New" : "\($0) new" }
        return [b, labelText].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " ")
    }
}

/// Density-derived lengths (every value derives from --md-sys-density-scale by calc) and the tab hooks.
struct AWCNavigationTabMetrics {
    let d: Double, look: AWCNavigationTabAppearance, behavior: String
    var indicatorWidth: Double { look.activeIndicatorWidth ?? max(40, 56 + 4 * d) }
    var indicatorHeight: Double { look.activeIndicatorHeight ?? max(24, 32 + 2 * d) }
    var iconSize: Double { look.iconSize ?? max(18, 24 + d) }
    var labelSize: Double { look.labelFontSize ?? max(10, 12 + 0.5 * d) }
    var lineHeight: Double { look.shorthand.lineHeight ?? 16 }
    var inactiveWeight: Double { look.shorthand.weight ?? 500 }
    var activeWeight: Double { look.labelFontWeight ?? 600 }
    var gap: Double { max(2, 6 + d) }
    /// Icon-only tabs centre the stack between 16-point paddings (the label-hidden padding replaces the hooks).
    var padTop: Double { behavior == "none" ? 16 : look.paddingBlockStart ?? 5 + d }
    var padBottom: Double { behavior == "none" ? 16 : look.paddingBlockEnd ?? 5 + d }
    var shape: Double { look.activeIndicatorShape ?? 9999 }
    var disabledOpacity: Double { look.disabledOpacity ?? 0.38 }
    var focusOpacity: Double { look.focusStateLayerOpacity ?? 0.1 }
}

/// Selection: activeIndex is truncated (NaN → 0), clamped into range and moved to the nearest activatable destination
/// (forward, then backward), −1 when none is (source `clampToEnabled`).
enum AWCNavigationSelection {
    static func clamp(_ raw: AWCValue?, _ disabled: [Bool]) -> Int {
        guard !disabled.isEmpty else { return -1 }
        let n: Double = { switch raw { case .number(let x)?: return x; case .string(let s)?: return Double(s.trimmingCharacters(in: .whitespaces)) ?? .nan; case .bool(let b)?: return b ? 1 : 0; default: return 0 } }()
        let t = n.isNaN ? 0 : n.rounded(.towardZero)
        let i = Int(max(0, min(Double(disabled.count - 1), t.isFinite ? t : (t > 0 ? Double(disabled.count - 1) : 0))))
        if !disabled[i] { return i }
        if let f = (i + 1 < disabled.count ? Array(i + 1..<disabled.count) : []).first(where: { !disabled[$0] }) { return f }
        if let b = stride(from: i - 1, through: 0, by: -1).first(where: { !disabled[$0] }) { return b }
        return -1
    }
    /// Arrow-key tour: wraps and skips hard-disabled destinations only.
    static func next(_ hard: [Bool], from: Int, _ dir: Int) -> Int {
        let n = hard.count; var i = from
        for _ in 0..<n { i = ((i + dir) % n + n) % n; if !hard[i] { return i } }
        return from
    }
}

/// Per-tab transitions: host colour (icon, state-layer currentColor), state layer, label colour and opacity, indicator.
final class AWCNavigationTabMotion {
    var color = AWCTabsTrack([0, 0, 0, 1]), labelColor = AWCTabsTrack([0, 0, 0, 1]), labelOpacity = AWCTabsTrack([1])
    var layer = AWCTabsTrack([0]), indicatorScale = AWCTabsTrack([0]), indicatorOpacity = AWCTabsTrack([0])
    var initialized = false
    func running(_ t: Double) -> Bool { [color, labelColor, labelOpacity, layer, indicatorScale, indicatorOpacity].contains { $0.running(t) } }
}

@MainActor @Observable final class AWCNavigationBarRuntime {
    var activeIndex = -1
    var hoverID: String?
    var pressedID: String?
    var tick = 0
    @ObservationIgnored var previousIndex = -1
    @ObservationIgnored var lastProperty: AWCValue?
    @ObservationIgnored var motions: [String: AWCNavigationTabMotion] = [:]
    @ObservationIgnored var handles: [String: AWCButtonFocusHandle] = [:]
    @ObservationIgnored var ripples: [String: AWCRippleController] = [:]
    @ObservationIgnored var frames: [String: CGRect] = [:]
    @ObservationIgnored var layerColors: [String: [Double]] = [:]
    init(node: AWCNode) {
        let tabs = node.children.filter { $0.tag == "md-navigation-tab" }
        let disabled = tabs.map { $0.properties["disabled"]?.bool == true || $0.properties["softDisabled"]?.bool == true }
        lastProperty = node.properties["activeIndex"]
        if node.properties["_standalone"]?.bool == true { activeIndex = tabs.first?.properties["active"]?.bool == true ? 0 : -1 }
        else { activeIndex = tabs.isEmpty ? -1 : AWCNavigationSelection.clamp(lastProperty ?? .number(0), disabled) }
        previousIndex = activeIndex
    }
    func motion(_ id: String) -> AWCNavigationTabMotion { if let m = motions[id] { return m }; let m = AWCNavigationTabMotion(); motions[id] = m; return m }
    func handle(_ id: String) -> AWCButtonFocusHandle { if let h = handles[id] { return h }; let h = AWCButtonFocusHandle(); handles[id] = h; return h }
    func ripple(_ id: String) -> AWCRippleController { if let r = ripples[id] { return r }; let r = AWCRippleController(); ripples[id] = r; return r }
}

struct AWCNavigationBarPalette {
    let tokens: [String: String], bar: AWCNavigationBarAppearance, tab: AWCNavigationTabAppearance
    func token(_ k: String, _ d: String) -> Color { Color(awcHex: tokens["--md-sys-color-" + k] ?? d) }
    func hex(_ v: String?) -> Color? { v.map { Color(awcHex: $0) } }
    var container: Color { hex(bar.containerColor) ?? token("surface-container", "#F3EDF7") }
    var divider: Color { hex(bar.dividerColor) ?? .clear }
    var onSurface: Color { token("on-surface", "#1C1B1F") }
    var indicator: Color { hex(tab.activeIndicatorColor) ?? token("secondary-container", "#E8DEF8") }
    var activeIcon: Color { hex(tab.activeIconColor) ?? token("on-secondary-container", "#1E192B") }
    var inactiveIcon: Color { hex(tab.inactiveIconColor) ?? token("on-surface-variant", "#49454F") }
    var activeLabel: Color { hex(tab.activeLabelColor) ?? token("on-surface", "#1C1B1F") }
    var inactiveLabel: Color { hex(tab.inactiveLabelColor) ?? token("on-surface-variant", "#49454F") }
    var hover: Color { hex(tab.hoverStateLayerColor) ?? onSurface }
    var focus: Color { hex(tab.focusStateLayerColor) ?? onSurface }
    var pressed: Color { hex(tab.pressedStateLayerColor) ?? onSurface }
    var badge: Color { hex(tab.badgeColor) ?? token("error", "#B3261E") }
    var onBadge: Color { hex(tab.badgeOnColor) ?? token("on-error", "#FFFFFF") }
    var focusRing: Color { token("secondary", "#625B71") }
}

struct AWCNavigationTabState: Equatable {
    var active = false, hardDisabled = false, softDisabled = false, hover = false, pressed = false, focused = false, focusVisible = false, tabStop = false
}

/// Tab-local geometry (points; physical x, RTL never mirrors inside a tab).
struct AWCNavigationTabGeometry {
    var x = 0.0, width = 0.0, height = 0.0
    var container = CGRect.zero, indicator = CGRect.zero, icon = CGRect.zero, label: CGRect? = nil, badge: CGRect? = nil
}

extension AWCNativeFonts {
    /// Advance width of a single-run label at a CSS weight (Roboto 400/500/700 files, synthesised steps between) plus
    /// the CSS letter-spacing after every character.
    static func navigationTextWidth(_ text: String, size: CGFloat, weight: Double, tracking: Double) -> Double {
        _ = label(size: size, weight: 500)
        let w = resolvedLabelWeight(weight)
        let font = CTFontCreateWithName((w >= 600 ? "Roboto-Bold" : w >= 500 ? "Roboto-Medium" : "Roboto-Regular") as CFString, size, nil)
        let line = CTLineCreateWithAttributedString(NSAttributedString(string: text, attributes: [NSAttributedString.Key(kCTFontAttributeName as String): font]))
        return Double(CTLineGetTypographicBounds(line, nil, nil, nil)) + tracking * Double(text.count)
    }
}

enum AWCNavigationBarLayout {
    /// flex: 1 1 0 with min-inline-size 64: equal shares, never narrower than 64 (an overflowing row keeps 64 each).
    static func widths(count: Int, width: Double) -> [Double] {
        guard count > 0 else { return [] }
        return Array(repeating: max(64, width / Double(count)), count: count)
    }
    static func tab(_ s: AWCNavigationTabSpec, metrics m: AWCNavigationTabMetrics, active: Bool, x: Double, width: Double, height: Double) -> AWCNavigationTabGeometry {
        var g = AWCNavigationTabGeometry(x: x, width: width, height: height)
        let iw = m.indicatorWidth, ih = m.indicatorHeight
        let hasLabel = m.behavior != "none"
        let labelW = hasLabel ? min(width, AWCNativeFonts.navigationTextWidth(s.labelText, size: CGFloat(m.labelSize), weight: active ? m.activeWeight : m.inactiveWeight, tracking: 0.5)) : 0
        let stackH = ih + (hasLabel ? m.gap + m.lineHeight : 0)
        // justify-content: center (icon-only) centres even an overflowing stack (negative free space splits evenly).
        let top = hasLabel ? m.padTop : m.padTop + (height - m.padTop - m.padBottom - stackH) / 2
        g.container = CGRect(x: 0, y: top, width: width, height: stackH)
        g.indicator = CGRect(x: (width - iw) / 2, y: top, width: iw, height: ih)
        g.icon = CGRect(x: (width - m.iconSize) / 2, y: top + (ih - m.iconSize) / 2, width: m.iconSize, height: m.iconSize)
        if hasLabel { g.label = CGRect(x: (width - labelW) / 2, y: top + ih + m.gap, width: labelW, height: m.lineHeight) }
        return g
    }
}

// MARK: - The bar

/// md-navigation-bar: full-width row of equal destinations (flex 1 1 0, min 64), surface-container, density-tapered
/// height; selection, roving tab stop, arrows (RTL mirrored, soft-disabled reachable, automatic or manual activation),
/// label behaviour inheritance, mdTabClick / mdChange and link following, as the source.
struct AWCNativeNavigationBar: View {
    let node: AWCNode
    let properties: [String: AWCValue]
    let theme: AWCTheme
    let inheritedDensity: Double
    /// (event, target node id, target tag, detail)
    let emit: (String, String, String, AWCValue) -> Void
    let setIndexProperty: (Int) -> Void
    let follow: (AWCNavigationTabSpec) -> Void
    let renderChild: (AWCNode) -> AnyView
    @Environment(\.layoutDirection) private var direction
    @Environment(\.accessibilityReduceMotion) private var systemReduceMotion
    @Environment(\.awcNavigationBarReducedMotion) private var reducedOverride
    @Environment(\.awcThemeTokens) private var tokens
    @Environment(\.awcNavigationBarAppearance) private var appearance
    @Environment(\.awcNavigationTabAppearance) private var tabAppearance
    @Environment(\.awcNavigationBarController) private var controller
    @Environment(\.awcNavigationTabController) private var tabController
    @Environment(\.awcNativePointerState) private var pointer
    @State private var runtime: AWCNavigationBarRuntime
    @State private var viewport: CGFloat = 0
    init(node: AWCNode, properties: [String: AWCValue], theme: AWCTheme, inheritedDensity: Double, emit: @escaping (String, String, String, AWCValue) -> Void,
         setIndexProperty: @escaping (Int) -> Void, follow: @escaping (AWCNavigationTabSpec) -> Void, renderChild: @escaping (AWCNode) -> AnyView) {
        self.node = node; self.properties = properties; self.theme = theme; self.inheritedDensity = inheritedDensity
        self.emit = emit; self.setIndexProperty = setIndexProperty; self.follow = follow; self.renderChild = renderChild
        _runtime = State(initialValue: AWCNavigationBarRuntime(node: node))
    }
    var reduced: Bool { reducedOverride ?? systemReduceMotion }
    var rtl: Bool { direction == .rightToLeft }
    var standalone: Bool { properties["_standalone"]?.bool == true }
    var specs: [AWCNavigationTabSpec] { node.children.filter { $0.tag == "md-navigation-tab" }.map(AWCNavigationTabSpec.init) }
    var barDensity: Double { AWCNativeDensity.resolve(properties["density"]?.number, inherited: inheritedDensity) }
    var barBehavior: String { properties["labelBehavior"]?.string ?? "always" }
    var manual: Bool { properties["manualActivation"]?.bool == true }
    var look: AWCNavigationTabAppearance { appearance.tab.merging(tabAppearance) }
    var label: String { [properties["aria-label"]?.string, properties["ariaLabel"]?.string].compactMap { $0 }.first { !$0.isEmpty } ?? "" }
    func behavior(_ s: AWCNavigationTabSpec) -> String {
        let b = s.ownLabelBehavior ?? (standalone ? "always" : barBehavior)
        return ["always", "selected", "none"].contains(b) ? b : "always"
    }
    func metrics(_ s: AWCNavigationTabSpec) -> AWCNavigationTabMetrics {
        AWCNavigationTabMetrics(d: AWCNativeDensity.resolve(s.p["density"]?.number, inherited: barDensity), look: look, behavior: behavior(s))
    }
    var height: Double { max(48, (appearance.containerHeight ?? 64) + 4 * barDensity) }

    // MARK: Selection

    func activeIndex(_ specs: [AWCNavigationTabSpec]) -> Int { standalone ? (specs.first?.p["active"]?.bool == true ? 0 : -1) : runtime.activeIndex }
    /// source updateSelection: clamp, reflect the normalised value, mark the tabs, emit when the applied index changed.
    func update(_ raw: AWCValue?, announce: Bool, _ specs: [AWCNavigationTabSpec]) {
        let clamped = specs.isEmpty ? -1 : AWCNavigationSelection.clamp(raw, specs.map(\.disabled))
        runtime.activeIndex = clamped
        if raw?.number != Double(clamped) { runtime.lastProperty = .number(Double(clamped)); setIndexProperty(clamped) }
        let previous = runtime.previousIndex
        runtime.previousIndex = clamped
        if announce && clamped != previous {
            emit("mdChange", node.id, "md-navigation-bar", .object(["index": .number(Double(clamped)), "previousIndex": .number(Double(previous))]))
        }
    }
    /// Pointer / Enter / Space: mdTabClick from the tab, then the bar selects it (no event when it is already active), then the link.
    func click(_ index: Int, _ specs: [AWCNavigationTabSpec]) {
        guard specs.indices.contains(index), !specs[index].disabled else { return }
        emit("mdTabClick", specs[index].id, "md-navigation-tab", .object(["index": .number(Double(standalone ? 0 : index))]))
        if !standalone && index != runtime.activeIndex { update(.number(Double(index)), announce: true, specs) }
        follow(specs[index])
    }
    func keyActivate(_ index: Int) {
        let specs = specs
        guard specs.indices.contains(index), !specs[index].disabled else { return }
        runtime.ripple(specs[index].id).trigger()
        click(index, specs)
    }
    /// Arrows follow the visual direction, wrap and skip hard-disabled destinations; focus moves; the target activates
    /// unless activation is manual or it is soft-disabled. Home/End go to the first/last not hard-disabled destination.
    func key(_ key: String, from id: String) -> Bool {
        let specs = specs, hard = specs.map(\.hardDisabled)
        guard !standalone, let current = specs.firstIndex(where: { $0.id == id }) else { return false }
        let dir = rtl ? -1 : 1
        let target: Int
        switch key {
        case "ArrowRight": target = AWCNavigationSelection.next(hard, from: current, dir)
        case "ArrowLeft": target = AWCNavigationSelection.next(hard, from: current, -dir)
        case "Home": target = hard.firstIndex(of: false) ?? 0
        case "End": target = hard.lastIndex(of: false) ?? specs.count - 1
        default: return false
        }
        guard target != current else { return true }
        _ = runtime.handle(specs[target].id).requestFocus?()
        if !manual && !specs[target].disabled { update(.number(Double(target)), announce: true, specs) }
        return true
    }
    func bindController() {
        controller?.selectHandler = { i in guard !standalone else { return }; update(.number(Double(i)), announce: true, self.specs) }
        controller?.focusHandler = { i in let s = self.specs; guard s.indices.contains(i), !s[i].hardDisabled else { return }; _ = runtime.handle(s[i].id).requestFocus?() }
        if standalone { tabController?.focusHandler = { guard let f = self.specs.first, !f.hardDisabled else { return }; _ = runtime.handle(f.id).requestFocus?() } }
    }

    // MARK: State and motion

    func state(_ s: AWCNavigationTabSpec, _ i: Int, active: Int) -> AWCNavigationTabState {
        let handle = runtime.handle(s.id)
        let pointerHover = pointer.map { p in p.location.map { runtime.frames[s.id]?.contains($0) ?? false } ?? false }
        let hover = !s.hardDisabled && (pointerHover ?? (runtime.hoverID == s.id))
        let pressed = !s.hardDisabled && (runtime.pressedID == s.id || (pointer?.isPointerDown == true && hover))
        return AWCNavigationTabState(active: i == active, hardDisabled: s.hardDisabled, softDisabled: s.softDisabled && !s.hardDisabled, hover: hover, pressed: pressed,
                                     focused: handle.isFocused, focusVisible: handle.isFocusVisible && !s.hardDisabled, tabStop: standalone ? !s.hardDisabled : i == active)
    }
    /// The state layer: focus-visible wins, then pressed, then hover (the stylesheet order); disabled tabs show none
    /// (a soft-disabled tab still shows the focus layer).
    func layer(_ st: AWCNavigationTabState, _ m: AWCNavigationTabMetrics, _ palette: AWCNavigationBarPalette, host: [Double]) -> (Double, [Double]) {
        if st.focusVisible { return (m.focusOpacity, awcTabsComponents(palette.focus)) }
        if st.hardDisabled || st.softDisabled { return (0, host) }
        if st.pressed { return (0.12, awcTabsComponents(palette.pressed)) }
        if st.hover { return (0.08, awcTabsComponents(palette.hover)) }
        return (0, host)
    }
    func targets(_ s: AWCNavigationTabSpec, _ st: AWCNavigationTabState, _ m: AWCNavigationTabMetrics, _ palette: AWCNavigationBarPalette, now: Double) {
        let motion = runtime.motion(s.id)
        let color = awcTabsComponents(st.active ? palette.activeIcon : palette.inactiveIcon)
        let labelColor = awcTabsComponents(st.active ? palette.activeLabel : palette.inactiveLabel)
        let labelOpacity: Double = m.behavior == "selected" && !st.active ? 0 : 1
        let (layer, layerColor) = self.layer(st, m, palette, host: color)
        runtime.layerColors[s.id] = layerColor
        if !motion.initialized {
            motion.color.snap(color); motion.labelColor.snap(labelColor); motion.labelOpacity.snap([labelOpacity]); motion.layer.snap([layer])
            motion.indicatorScale.snap([st.active ? 1 : 0]); motion.indicatorOpacity.snap([st.active ? 1 : 0]); motion.initialized = true; return
        }
        let r = reduced
        motion.color.set(color, duration: r ? 0 : 200, curve: .emphasizedDecelerate, now: now)
        motion.labelColor.set(labelColor, duration: r ? 0 : 100, curve: .ease, now: now)
        motion.labelOpacity.set([labelOpacity], duration: r ? 0 : 100, curve: .ease, now: now)
        motion.layer.set([layer], duration: r ? 0 : 100, curve: .ease, now: now)
        motion.indicatorScale.set([st.active ? 1 : 0], duration: r ? 0 : 200, curve: .emphasizedDecelerate, now: now)
        motion.indicatorOpacity.set([st.active ? 1 : 0], duration: r ? 0 : 100, curve: .ease, now: now)
    }
}

extension AWCNativeNavigationBar {
    var body: some View {
        let specs = specs, now = AWCTabsClock.now(), active = activeIndex(specs)
        let palette = AWCNavigationBarPalette(tokens: tokens.isEmpty ? theme.tokens : tokens, bar: appearance, tab: look)
        let divider = appearance.dividerWidth ?? 0
        let w = Double(viewport)
        let standaloneWidth = standalone ? specs.first.map { s -> Double in
            let m = metrics(s); return max(48, m.indicatorWidth, behavior(s) == "none" ? 0 : AWCNativeFonts.navigationTextWidth(s.labelText, size: CGFloat(m.labelSize), weight: m.activeWeight, tracking: 0.5))
        } ?? 64 : nil
        let widths = standalone ? [standaloneWidth ?? 64] : AWCNavigationBarLayout.widths(count: specs.count, width: w)
        let content = widths.reduce(0, +)
        let states = specs.enumerated().map { state($1, $0, active: active) }
        let geometry: [AWCNavigationTabGeometry] = specs.enumerated().map { i, s in
            // RTL starts at the right edge (an overflowing row overflows to the left).
            let x = widths.prefix(i).reduce(0, +), physical = rtl ? (standalone ? content : w) - x - widths[i] : x
            return AWCNavigationBarLayout.tab(s, metrics: metrics(s), active: states[i].active, x: physical, width: widths[i], height: height)
        }
        for (i, s) in specs.enumerated() { targets(s, states[i], metrics(s), palette, now: now) }
        let animating = specs.contains { runtime.motion($0.id).running(now) }
        let _ = runtime.tick
        let _ = bindController()
        let corners = appearance.containerShape ?? .points(0)
        // The host: the shaped container colour with the top border (border-block-start follows the corners) and the
        // shadow; the tabs are not clipped (overflow: visible), laid out at physical frames below the border.
        let frames = geometry.map { CGRect(x: $0.x, y: 0, width: $0.width, height: $0.height) }
        return VStack(spacing: 0) {
            Color.clear.frame(height: CGFloat(divider))
            TimelineView(AWCTabsClock.schedule(paused: !animating)) { _ in
                let t = AWCTabsClock.now()
                AWCTabsRow(frames: frames, size: CGSize(width: max(content, w), height: height)) {
                    ForEach(Array(specs.enumerated()), id: \.element.id) { i, s in
                        tab(s, i, geometry[i], states[i], metrics(s), palette, at: t)
                            .environment(\.awcInspectionAlias, AWCInspectionAlias(childID: s.id, parentID: node.id, part: "tab-\(i)"))
                    }
                }
            }
            .frame(width: standalone ? nil : CGFloat(w), height: CGFloat(height), alignment: .topLeading)
            .environment(\.layoutDirection, .leftToRight)
        }
        .frame(maxWidth: standalone ? CGFloat(standaloneWidth ?? 64) : .infinity, alignment: .topLeading)
        .frame(width: standalone ? CGFloat(standaloneWidth ?? 64) : nil)
        .background {
            if !standalone {
                ZStack(alignment: .top) {
                    AWCNativeCornerShape(corners: corners).fill(palette.container)
                    Rectangle().fill(palette.divider).frame(height: CGFloat(divider)).frame(maxHeight: .infinity, alignment: .top)
                }
                .clipShape(AWCNativeCornerShape(corners: corners))
                .awcInspect(nodeID: node.id, part: "container", name: "container") { _ in [:] }
            }
        }
        .background { if !standalone, let layers = appearance.containerElevation, !layers.isEmpty { AWCNativeBoxShadow(corners: corners, layers: layers, placement: .outer) } }
        .zIndex(appearance.zIndex ?? 200)
        .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { viewport = $0 }
        .modifier(AWCNavigationBarAccessibility(id: node.id, label: label, enabled: !standalone))
        .awcInspect(nodeID: node.id, name: "md-navigation-bar") { _ in
            ["activeIndex": .number(Double(active)), "count": .number(Double(specs.count)), "height": .number(height), "label": .string(label),
             "labelBehavior": .string(barBehavior), "manualActivation": .bool(manual), "reduced": .bool(reduced), "container": awcTabsRGBA(awcTabsComponents(palette.container)),
             "divider": awcTabsRGBA(awcTabsComponents(palette.divider)), "dividerWidth": .number(divider), "zIndex": .number(appearance.zIndex ?? 200),
             "elevation": .number(Double(appearance.containerElevation?.count ?? 0))]
        }
        .onChange(of: node.properties["activeIndex"]) { _, value in
            guard !standalone, value != runtime.lastProperty else { return }
            runtime.lastProperty = value; update(value, announce: true, self.specs)
        }
        .onChange(of: specs.map(\.id)) { _, _ in if !standalone { update(.number(Double(runtime.activeIndex)), announce: false, self.specs) } }
        .onChange(of: specs.map(\.disabled)) { _, _ in if !standalone { update(.number(Double(runtime.activeIndex)), announce: false, self.specs) } }
    }

    @ViewBuilder func tab(_ s: AWCNavigationTabSpec, _ i: Int, _ g: AWCNavigationTabGeometry, _ st: AWCNavigationTabState, _ m: AWCNavigationTabMetrics,
                          _ palette: AWCNavigationBarPalette, at t: Double) -> some View {
        let motion = runtime.motion(s.id)
        let color = motion.color.value(t), layer = motion.layer.value(t)[0], layerColor = runtime.layerColors[s.id] ?? color
        let host = awcTabsColor(color)
        let size = CGSize(width: g.width, height: g.height)
        let name = s.name(behavior: m.behavior)
        let inert = st.hardDisabled || st.softDisabled
        ZStack(alignment: .topLeading) {
            // The surface takes the pointer (its parts let hits through), so the md-ripple wave starts under any point of the tab.
            Color.clear.contentShape(Rectangle())
                .modifier(AWCRippleSurface(disabled: inert, hidden: false, cornerRadius: 0, contentColor: host, controller: runtime.ripple(s.id), local: nil, inspectNodeID: s.id + "-ripple"))
            Rectangle().fill(awcTabsColor(layerColor)).opacity(layer).allowsHitTesting(false)
                .awcInspect(nodeID: s.id, part: "state-layer", name: "state-layer") { _ in ["opacity": .number(layer), "color": awcTabsRGBA(layerColor)] }
            parts(s, g, st, m, palette, motion, host: host, at: t).allowsHitTesting(false)
        }
        .frame(width: size.width, height: size.height, alignment: .topLeading)
        .opacity(inert ? m.disabledOpacity : 1)
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
        .allowsHitTesting(!st.hardDisabled)
        .onGeometryChange(for: CGRect.self) { $0.frame(in: .named("awc-native-preview")) } action: { runtime.frames[s.id] = $0 }
        .awcFocusBridgeLayer {
            AWCNativeButtonFocusBridge(configuration: AWCNativeFocusConfiguration(
                id: s.id, label: name,
                policy: AWCButtonAccessibilityPolicy(properties: ["roleOverride": .string("tab"), "selected": .bool(st.active), "disabled": .bool(st.hardDisabled),
                                                                   "softDisabled": .bool(st.softDisabled), "groupTabindex": .number(st.tabStop ? 0 : -1)]),
                group: nil, cell: nil, handle: runtime.handle(s.id), focusChanged: { _ in },
                activate: { keyActivate(i) }, routeKey: { k, _, _ in key(k, from: s.id) }))
        }
        .awcInspect(nodeID: s.id, name: "md-navigation-tab") { _ in
            ["active": .bool(st.active), "disabled": .bool(st.hardDisabled), "softDisabled": .bool(st.softDisabled), "tabStop": .bool(st.tabStop),
             "focused": .bool(st.focused), "focusVisible": .bool(st.focusVisible), "hover": .bool(st.hover), "pressed": .bool(st.pressed),
             "color": awcTabsRGBA(color), "layerOpacity": .number(layer), "layerColor": awcTabsRGBA(layerColor),
             "labelColor": awcTabsRGBA(motion.labelColor.value(t)), "labelOpacity": .number(motion.labelOpacity.value(t)[0]),
             "indicatorScale": .number(motion.indicatorScale.value(t)[0]), "indicatorOpacity": .number(motion.indicatorOpacity.value(t)[0]),
             "indicatorColor": awcTabsRGBA(awcTabsComponents(palette.indicator)), "opacity": .number(inert ? m.disabledOpacity : 1),
             "name": .string(name), "behavior": .string(m.behavior), "renderTime": .number(t), "animating": .bool(motion.running(t))]
        }
    }

    @ViewBuilder func parts(_ s: AWCNavigationTabSpec, _ g: AWCNavigationTabGeometry, _ st: AWCNavigationTabState, _ m: AWCNavigationTabMetrics,
                            _ palette: AWCNavigationBarPalette, _ motion: AWCNavigationTabMotion, host: Color, at t: Double) -> some View {
        let scale = motion.indicatorScale.value(t)[0], opacity = motion.indicatorOpacity.value(t)[0]
        let radius = min(m.shape, Double(g.indicator.height) / 2, Double(g.indicator.width) / 2)
        let labelColor = awcTabsColor(motion.labelColor.value(t)), labelOpacity = motion.labelOpacity.value(t)[0]
        let badgeFrame = badgeRect(s, g, m)
        let frames: [CGRect] = [g.container, g.indicator, g.indicator, g.icon, g.label ?? .zero, badgeFrame ?? .zero,
                                g.indicator.insetBy(dx: -4, dy: -4)]
        AWCTabParts(frames: frames, size: CGSize(width: g.width, height: g.height)) {
            Color.clear.awcInspect(nodeID: s.id, part: "container", name: "container") { _ in [:] }
            RoundedRectangle(cornerRadius: CGFloat(radius), style: .circular).fill(palette.indicator)
                .awcInspect(nodeID: s.id, part: "indicator", name: "indicator") { _ in
                    ["opacity": .number(opacity), "scale": .number(scale), "color": awcTabsRGBA(awcTabsComponents(palette.indicator)), "radius": .number(radius)]
                }
                .scaleEffect(x: scale, y: 1, anchor: .center).opacity(opacity)
            Color.clear.awcInspect(nodeID: s.id, part: "icon-container", name: "icon-container") { _ in [:] }
            icon(s, st, m, host: host)
                .awcInspect(nodeID: s.id, part: "icon", name: "icon") { _ in ["color": awcTabsRGBA(awcTabsComponents(host)), "size": .number(m.iconSize), "glyph": .string(glyph(s, st))] }
            Group {
                if g.label != nil {
                    AWCTabLabelBox(measured: AWCNativeFonts.navigationTextWidth(s.labelText, size: CGFloat(m.labelSize), weight: st.active ? m.activeWeight : m.inactiveWeight, tracking: 0.5)) {
                        Text(s.labelText).font(AWCNativeFonts.label(size: CGFloat(m.labelSize), weight: st.active ? m.activeWeight : m.inactiveWeight)).tracking(0.5)
                            .lineLimit(1).truncationMode(.tail).foregroundStyle(labelColor)
                    }
                    .opacity(labelOpacity)
                    .awcInspect(nodeID: s.id, part: "label", name: "label") { _ in
                        ["color": awcTabsRGBA(awcTabsComponents(labelColor)), "opacity": .number(labelOpacity), "fontSize": .number(m.labelSize),
                         "fontWeight": .number(st.active ? m.activeWeight : m.inactiveWeight), "text": .string(s.labelText)]
                    }
                } else { Color.clear }
            }
            badge(s, m, palette)
            Group {
                if st.focusVisible {
                    RoundedRectangle(cornerRadius: CGFloat(min(m.shape, (Double(g.indicator.height) + 8) / 2, (Double(g.indicator.width) + 8) / 2)), style: .circular)
                        .strokeBorder(palette.focusRing, lineWidth: 3)
                        .awcInspect(nodeID: s.id, part: "focus-ring", name: "focus-ring") { _ in ["color": awcTabsRGBA(awcTabsComponents(palette.focusRing))] }
                } else { Color.clear }
            }
        }
        .accessibilityHidden(true)
    }
    func glyph(_ s: AWCNavigationTabSpec, _ st: AWCNavigationTabState) -> String { st.active && !s.activeIcon.isEmpty ? s.activeIcon : s.icon }
    /// The active tab shows the active-icon slot, else the icon glyph; an inactive tab the icon slot, else the glyph.
    @ViewBuilder func icon(_ s: AWCNavigationTabSpec, _ st: AWCNavigationTabState, _ m: AWCNavigationTabMetrics, host: Color) -> some View {
        let slot = st.active ? s.slotActiveIcon : s.slotIcon
        // The icon box is icon-size square (the glyph's line box overflows it, centred, as the inline-flex icon span).
        Group {
            if let slot { renderChild(slot).font(m.look.slottedIconFont.map { Font.custom($0, fixedSize: CGFloat(m.iconSize)) } ?? .system(size: CGFloat(m.iconSize))).foregroundStyle(host) }
            else { Text(glyph(s, st)).font(AWCNativeFonts.symbol(size: CGFloat(m.iconSize))).foregroundStyle(host).fixedSize() }
        }
        .frame(width: CGFloat(m.iconSize), height: CGFloat(m.iconSize))
    }
    /// Small dot: 6 × 6 at top 2 / inline-end 14 of the icon container. Large: 16 tall, min 16 wide (4-point padding,
    /// label-small 500 11/16, tracking 0.5), anchored on the glyph's inline-end top corner, then translate(50%, −50%)
    /// (physical, also in RTL as Chrome renders it).
    func badgeRect(_ s: AWCNavigationTabSpec, _ g: AWCNavigationTabGeometry, _ m: AWCNavigationTabMetrics) -> CGRect? {
        guard let text = s.badge else { return nil }
        let c = g.indicator
        if text.isEmpty {
            return CGRect(x: rtl ? c.minX + 14 : c.maxX - 14 - 6, y: c.minY + 2, width: 6, height: 6)
        }
        let w = max(16, AWCNativeFonts.navigationTextWidth(text, size: 11, weight: 500, tracking: 0.5) + 8)
        let inset = (Double(c.width) - m.iconSize) / 2, top = (Double(c.height) - m.iconSize) / 2
        let x0 = rtl ? Double(c.minX) + inset : Double(c.maxX) - inset - w
        return CGRect(x: x0 + w / 2, y: Double(c.minY) + top - 8, width: w, height: 16)
    }
    @ViewBuilder func badge(_ s: AWCNavigationTabSpec, _ m: AWCNavigationTabMetrics, _ palette: AWCNavigationBarPalette) -> some View {
        if let text = s.badge {
            ZStack {
                Capsule().fill(palette.badge)
                if !text.isEmpty { Text(text).font(AWCNativeFonts.label(size: 11, weight: 500)).tracking(0.5).foregroundStyle(palette.onBadge).fixedSize() }
            }
            .awcInspect(nodeID: s.id, part: "badge", name: "badge") { _ in
                ["text": .string(text), "color": awcTabsRGBA(awcTabsComponents(palette.badge)), "textColor": awcTabsRGBA(awcTabsComponents(palette.onBadge))]
            }
        } else { Color.clear }
    }
}

/// The landmark: macOS a navigation landmark group (named by aria-label) holding the tab group; iOS a labelled container.
struct AWCNavigationBarAccessibility: ViewModifier {
    let id: String, label: String, enabled: Bool
    @ViewBuilder func body(content: Content) -> some View {
        if !enabled { content } else {
        #if canImport(AppKit)
        content.accessibilityHidden(true).background { AWCNavigationBarLandmarkBridge(label: label, identifier: id) }
        #else
        content.accessibilityElement(children: .contain).accessibilityLabel(label).accessibilityIdentifier(id)
        #endif
        }
    }
}

extension AWCNativeView {
    func followNavigationTab(_ s: AWCNavigationTabSpec) {
        let href = s.p["href"]?.string ?? ""
        guard !href.isEmpty else { return }
        let router = urlRouter ?? AWCURLRouter { request in openURL(request.url); return true }
        router.route(href: href, target: (s.p["target"]?.string).flatMap { $0.isEmpty ? nil : $0 } ?? "_self", nodeID: s.id)
    }
    /// md-navigation-bar: the dedicated renderer (its md-navigation-tab children are managed by it).
    @ViewBuilder var nativeNavigationBar: some View {
        let properties = node.properties.merging(local) { _, l in l }
        AWCNativeNavigationBar(node: node, properties: properties, theme: theme, inheritedDensity: inheritedDensity,
                               emit: { emitTabs($0, $1, $2, $3) }, setIndexProperty: { set("activeIndex", .number(Double($0))) },
                               follow: { followNavigationTab($0) }, renderChild: { child($0) })
    }
    /// A destination outside a bar: its own `active` and tab stop; activation emits mdTabClick only (index −1) and follows its link.
    @ViewBuilder var nativeNavigationTab: some View {
        let properties = node.properties.merging(local) { _, l in l }
        let tab = AWCNode(id: node.id, tag: node.tag, properties: properties, children: node.children)
        let bar = AWCNode(id: node.id + "\u{0}bar", tag: "md-navigation-bar", properties: ["_standalone": .bool(true)], children: [tab])
        AWCNativeNavigationBar(node: bar, properties: bar.properties, theme: theme, inheritedDensity: inheritedDensity,
                               emit: { emitTabs($0, $1, $2, $3) }, setIndexProperty: { _ in }, follow: { followNavigationTab($0) }, renderChild: { child($0) })
    }
}

#if canImport(AppKit)
import AppKit
/// The bar as Chrome exposes it: the host's navigation landmark (AXGroup/AXLandmarkNavigation, named by the bar's
/// aria-label) holding the unnamed tablist (AXTabGroup) whose children are the destinations' focus bridges.
final class AWCNavigationBarLandmarkView: NSView {
    var label = "", elementIdentifier = ""
    let tablist = AWCNativeContainerAccessibilityView()
    override init(frame: NSRect) {
        super.init(frame: frame)
        tablist.role = NSAccessibility.Role(rawValue: "AXTabGroup"); tablist.members = .all; tablist.autoresizingMask = [.width, .height]
        addSubview(tablist)
    }
    required init?(coder: NSCoder) { nil }
    override func layout() { super.layout(); tablist.frame = bounds }
    override func hitTest(_ point: NSPoint) -> NSView? { nil }
    override func isAccessibilityElement() -> Bool { true }
    override func accessibilityRole() -> NSAccessibility.Role? { .group }
    override func accessibilitySubrole() -> NSAccessibility.Subrole? { NSAccessibility.Subrole(rawValue: "AXLandmarkNavigation") }
    override func accessibilityLabel() -> String? { label }
    override func accessibilityIdentifier() -> String { elementIdentifier }
    override func accessibilityChildren() -> [Any]? { [tablist] }
}
struct AWCNavigationBarLandmarkBridge: NSViewRepresentable {
    let label: String, identifier: String
    func makeNSView(context: Context) -> AWCNavigationBarLandmarkView { AWCNavigationBarLandmarkView() }
    func updateNSView(_ view: AWCNavigationBarLandmarkView, context: Context) {
        view.label = label; view.elementIdentifier = identifier; view.tablist.containerIdentifier = identifier + ".tablist"
    }
}
#endif
