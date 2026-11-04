import SwiftUI

/// md-card sizing hooks: px, %, em, rem and ch with additive calc(). Percentages
/// resolve against the proposed parent size like the source's containing block.
public typealias AWCCardLength = AWCSkeletonLength

/// Physical CSS padding (`--md-card-padding` shorthand order: top, right, bottom, left).
public struct AWCCardInsets: Equatable, Sendable {
    public let top: Double, right: Double, bottom: Double, left: Double
    public init(top: Double, right: Double, bottom: Double, left: Double) { self.top=top; self.right=right; self.bottom=bottom; self.left=left }
    public init(_ all: Double) { self.init(top: all, right: all, bottom: all, left: all) }
    public init(vertical: Double, horizontal: Double) { self.init(top: vertical, right: horizontal, bottom: vertical, left: horizontal) }
    var valid: Bool { [top,right,bottom,left].allSatisfy { $0.isFinite && $0 >= 0 } }
    public init?(values: [String: AWCValue]) {
        guard Set(values.keys).isSubset(of: ["top","right","bottom","left"]) else { return nil }
        func n(_ k: String) -> Double? { guard let v = values[k] else { return 0 }; guard case .number(let d) = v else { return nil }; return d }
        guard let t = n("top"), let r = n("right"), let b = n("bottom"), let l = n("left") else { return nil }
        self.init(top: t, right: r, bottom: b, left: l); if !valid { return nil }
    }
}

func awcCardColor(_ value: String?) -> String? {
    guard let value, value.range(of: "^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$", options: .regularExpression) != nil else { return nil }
    return value.uppercased()
}

/// The fourteen public md-card hooks (`--md-card-*`). Unset fields keep the
/// variant/theme/density defaults; state rules still override the elevation
/// hook and the disabled rules override color and elevation, as in the source.
public struct AWCCardAppearance: Equatable, Sendable {
    public let containerColor: String?, containerShape: AWCCornerShape?, containerElevation: [AWCBoxShadow]?
    public let outlineColor: String?, outlineWidth: Double?, stateLayerColor: String?
    public let width: AWCCardLength?, minWidth: AWCCardLength?, maxWidth: AWCCardLength?
    public let height: AWCCardLength?, minHeight: AWCCardLength?, maxHeight: AWCCardLength?
    public let padding: AWCCardInsets?, gap: Double?
    public init(containerColor: String? = nil, containerShape: AWCCornerShape? = nil, containerElevation: [AWCBoxShadow]? = nil,
                outlineColor: String? = nil, outlineWidth: Double? = nil, stateLayerColor: String? = nil,
                width: AWCCardLength? = nil, minWidth: AWCCardLength? = nil, maxWidth: AWCCardLength? = nil,
                height: AWCCardLength? = nil, minHeight: AWCCardLength? = nil, maxHeight: AWCCardLength? = nil,
                padding: AWCCardInsets? = nil, gap: Double? = nil) {
        self.containerColor = awcCardColor(containerColor); self.containerShape = containerShape.flatMap { $0.valid ? $0 : nil }
        self.containerElevation = containerElevation.flatMap { $0.allSatisfy(\.valid) ? $0 : nil }
        self.outlineColor = awcCardColor(outlineColor); self.outlineWidth = outlineWidth.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.stateLayerColor = awcCardColor(stateLayerColor)
        func length(_ l: AWCCardLength?) -> AWCCardLength? { l.flatMap { $0.valid ? $0 : nil } }
        self.width = length(width); self.minWidth = length(minWidth); self.maxWidth = length(maxWidth)
        self.height = length(height); self.minHeight = length(minHeight); self.maxHeight = length(maxHeight)
        self.padding = padding.flatMap { $0.valid ? $0 : nil }; self.gap = gap.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
    }
    public init(values: [String: AWCValue]) {
        func text(_ k: String) -> String? { values[k]?.string.isEmpty == false ? values[k]?.string : nil }
        func number(_ k: String) -> Double? { values[k]?.number }
        func length(_ k: String) -> AWCCardLength? { guard case .object(let v) = values[k] else { return nil }; return AWCCardLength(values: v) }
        func shape(_ k: String) -> AWCCornerShape? { guard case .object(let v) = values[k] else { return nil }; return AWCCornerShape(values: v) }
        func insets(_ k: String) -> AWCCardInsets? { guard case .object(let v) = values[k] else { return nil }; return AWCCardInsets(values: v) }
        func shadow(_ k: String) -> [AWCBoxShadow]? {
            guard case .array(let a) = values[k] else { return nil }
            let r = a.compactMap { v -> AWCBoxShadow? in guard case .object(let f) = v else { return nil }; return .init(values: f) }
            return r.count == a.count ? r : nil
        }
        self.init(containerColor: text("containerColor"), containerShape: shape("containerShape"), containerElevation: shadow("containerElevation"),
                  outlineColor: text("outlineColor"), outlineWidth: number("outlineWidth"), stateLayerColor: text("stateLayerColor"),
                  width: length("width"), minWidth: length("minWidth"), maxWidth: length("maxWidth"),
                  height: length("height"), minHeight: length("minHeight"), maxHeight: length("maxHeight"),
                  padding: insets("padding"), gap: number("gap"))
    }
    public func merging(_ o: Self) -> Self {
        .init(containerColor: o.containerColor ?? containerColor, containerShape: o.containerShape ?? containerShape, containerElevation: o.containerElevation ?? containerElevation,
              outlineColor: o.outlineColor ?? outlineColor, outlineWidth: o.outlineWidth ?? outlineWidth, stateLayerColor: o.stateLayerColor ?? stateLayerColor,
              width: o.width ?? width, minWidth: o.minWidth ?? minWidth, maxWidth: o.maxWidth ?? maxWidth,
              height: o.height ?? height, minHeight: o.minHeight ?? minHeight, maxHeight: o.maxHeight ?? maxHeight,
              padding: o.padding ?? padding, gap: o.gap ?? gap)
    }
}

/// `::part(state-layer)` and `::part(outline)` styling. Part rules come from the
/// outer tree, so they win over the hooks and every internal state rule.
public struct AWCCardPartAppearance: Equatable, Sendable {
    public let stateLayerColor: String?, outlineColor: String?, outlineWidth: Double?
    public init(stateLayerColor: String? = nil, outlineColor: String? = nil, outlineWidth: Double? = nil) {
        self.stateLayerColor = awcCardColor(stateLayerColor); self.outlineColor = awcCardColor(outlineColor)
        self.outlineWidth = outlineWidth.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
    }
    public init(values: [String: AWCValue]) {
        self.init(stateLayerColor: values["stateLayerColor"]?.string, outlineColor: values["outlineColor"]?.string, outlineWidth: values["outlineWidth"]?.number)
    }
    public func merging(_ o: Self) -> Self { .init(stateLayerColor: o.stateLayerColor ?? stateLayerColor, outlineColor: o.outlineColor ?? outlineColor, outlineWidth: o.outlineWidth ?? outlineWidth) }
}

private struct AWCCardAppearanceKey: EnvironmentKey { static let defaultValue = AWCCardAppearance() }
private struct AWCCardAppearanceTargetsKey: EnvironmentKey { static let defaultValue: [String: AWCCardAppearance] = [:] }
private struct AWCCardPartAppearanceKey: EnvironmentKey { static let defaultValue = AWCCardPartAppearance() }
private struct AWCCardPartAppearanceTargetsKey: EnvironmentKey { static let defaultValue: [String: AWCCardPartAppearance] = [:] }
private struct AWCCardReducedMotionKey: EnvironmentKey { static let defaultValue: Bool? = nil }
extension EnvironmentValues {
    var awcCardAppearance: AWCCardAppearance { get { self[AWCCardAppearanceKey.self] } set { self[AWCCardAppearanceKey.self] = newValue } }
    var awcCardAppearanceTargets: [String: AWCCardAppearance] { get { self[AWCCardAppearanceTargetsKey.self] } set { self[AWCCardAppearanceTargetsKey.self] = newValue } }
    var awcCardPartAppearance: AWCCardPartAppearance { get { self[AWCCardPartAppearanceKey.self] } set { self[AWCCardPartAppearanceKey.self] = newValue } }
    var awcCardPartAppearanceTargets: [String: AWCCardPartAppearance] { get { self[AWCCardPartAppearanceTargetsKey.self] } set { self[AWCCardPartAppearanceTargetsKey.self] = newValue } }
    /// Overrides the system reduce-motion setting for card transitions (tests, previews).
    var awcCardReducedMotion: Bool? { get { self[AWCCardReducedMotionKey.self] } set { self[AWCCardReducedMotionKey.self] = newValue } }
}
private struct AWCCardAppearanceModifier: ViewModifier {
    let value: AWCCardAppearance, id: String?
    @Environment(\.awcCardAppearance) private var inherited
    @Environment(\.awcCardAppearanceTargets) private var targets
    func body(content: Content) -> some View {
        if let id { var t = targets; t[id] = (t[id] ?? .init()).merging(value); return AnyView(content.environment(\.awcCardAppearanceTargets, t)) }
        return AnyView(content.environment(\.awcCardAppearance, inherited.merging(value)))
    }
}
private struct AWCCardPartAppearanceModifier: ViewModifier {
    let value: AWCCardPartAppearance, id: String?
    @Environment(\.awcCardPartAppearance) private var inherited
    @Environment(\.awcCardPartAppearanceTargets) private var targets
    func body(content: Content) -> some View {
        if let id { var t = targets; t[id] = (t[id] ?? .init()).merging(value); return AnyView(content.environment(\.awcCardPartAppearanceTargets, t)) }
        return AnyView(content.environment(\.awcCardPartAppearance, inherited.merging(value)))
    }
}
public extension View {
    /// Applies md-card hook values to descendant cards, or to the card with `id`.
    func awcCardAppearance(_ value: AWCCardAppearance, for id: String? = nil) -> some View { modifier(AWCCardAppearanceModifier(value: value, id: id)) }
    /// Applies `::part(state-layer)` / `::part(outline)` styling to descendant cards, or to the card with `id`.
    func awcCardPartAppearance(_ value: AWCCardPartAppearance, for id: String? = nil) -> some View { modifier(AWCCardPartAppearanceModifier(value: value, id: id)) }
    /// Forces reduced (or full) motion for descendant cards, overriding the system setting.
    func awcCardReducedMotion(_ reduced: Bool?) -> some View { environment(\.awcCardReducedMotion, reduced) }
}
