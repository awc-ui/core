import SwiftUI

/// md-chip length hooks (`--md-chip-icon-size`, `--md-chip-container-height`): px, em, rem
/// and ch with additive calc(); em/ch resolve against the chip's own font size.
public typealias AWCChipLength = AWCSkeletonLength

func awcChipColor(_ value: String?) -> String? {
    guard let value, value.range(of: "^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$", options: .regularExpression) != nil else { return nil }
    return value.uppercased()
}

/// The twelve public md-chip hooks (`--md-chip-*`). Unset fields keep the variant /
/// appearance / colour-role / density defaults. As in the source, the disabled rules
/// still override the content colours and the elevation.
public struct AWCChipHookAppearance: Equatable, Sendable {
    public let containerColor: String?, containerColorSelected: String?
    public let labelColor: String?, labelColorSelected: String?
    public let iconColor: String?, iconSize: AWCChipLength?
    public let containerShape: AWCCornerShape?, containerHeight: AWCChipLength?
    public let outlineColor: String?, outlineWidth: Double?
    public let stateLayerColor: String?, elevation: [AWCBoxShadow]?
    public init(containerColor: String? = nil, containerColorSelected: String? = nil, labelColor: String? = nil, labelColorSelected: String? = nil,
                iconColor: String? = nil, iconSize: AWCChipLength? = nil, containerShape: AWCCornerShape? = nil, containerHeight: AWCChipLength? = nil,
                outlineColor: String? = nil, outlineWidth: Double? = nil, stateLayerColor: String? = nil, elevation: [AWCBoxShadow]? = nil) {
        self.containerColor = awcChipColor(containerColor); self.containerColorSelected = awcChipColor(containerColorSelected)
        self.labelColor = awcChipColor(labelColor); self.labelColorSelected = awcChipColor(labelColorSelected)
        self.iconColor = awcChipColor(iconColor); self.iconSize = iconSize.flatMap { $0.valid && $0.fraction == 0 ? $0 : nil }
        self.containerShape = containerShape.flatMap { $0.valid ? $0 : nil }; self.containerHeight = containerHeight.flatMap { $0.valid && $0.fraction == 0 ? $0 : nil }
        self.outlineColor = awcChipColor(outlineColor); self.outlineWidth = outlineWidth.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.stateLayerColor = awcChipColor(stateLayerColor); self.elevation = elevation.flatMap { $0.allSatisfy(\.valid) ? $0 : nil }
    }
    public init(values: [String: AWCValue]) {
        func text(_ k: String) -> String? { values[k]?.string.isEmpty == false ? values[k]?.string : nil }
        func length(_ k: String) -> AWCChipLength? { if case .number(let n) = values[k] { return .points(n) }; guard case .object(let v) = values[k] else { return nil }; return AWCChipLength(values: v) }
        func shape(_ k: String) -> AWCCornerShape? { guard case .object(let v) = values[k] else { return nil }; return AWCCornerShape(values: v) }
        func shadow(_ k: String) -> [AWCBoxShadow]? {
            guard case .array(let a) = values[k] else { return nil }
            let r = a.compactMap { v -> AWCBoxShadow? in guard case .object(let f) = v else { return nil }; return .init(values: f) }
            return r.count == a.count ? r : nil
        }
        self.init(containerColor: text("containerColor"), containerColorSelected: text("containerColorSelected"), labelColor: text("labelColor"),
                  labelColorSelected: text("labelColorSelected"), iconColor: text("iconColor"), iconSize: length("iconSize"), containerShape: shape("containerShape"),
                  containerHeight: length("containerHeight"), outlineColor: text("outlineColor"), outlineWidth: values["outlineWidth"]?.number,
                  stateLayerColor: text("stateLayerColor"), elevation: shadow("elevation"))
    }
    public func merging(_ o: Self) -> Self {
        .init(containerColor: o.containerColor ?? containerColor, containerColorSelected: o.containerColorSelected ?? containerColorSelected,
              labelColor: o.labelColor ?? labelColor, labelColorSelected: o.labelColorSelected ?? labelColorSelected, iconColor: o.iconColor ?? iconColor,
              iconSize: o.iconSize ?? iconSize, containerShape: o.containerShape ?? containerShape, containerHeight: o.containerHeight ?? containerHeight,
              outlineColor: o.outlineColor ?? outlineColor, outlineWidth: o.outlineWidth ?? outlineWidth, stateLayerColor: o.stateLayerColor ?? stateLayerColor,
              elevation: o.elevation ?? elevation)
    }
}

/// `::part()` styling of the chip's parts. Part rules come from the outer tree, so they win
/// over the hooks and every internal rule (`state-layer`, `outline`, `label`, `icon`,
/// `trailing-icon`, `checkmark`, `remove`).
public struct AWCChipPartAppearance: Equatable, Sendable {
    public let stateLayerColor: String?, stateLayerOpacity: Double?
    public let outlineColor: String?, outlineWidth: Double?
    public let labelColor: String?, iconColor: String?, trailingIconColor: String?, checkmarkColor: String?, removeColor: String?
    /// `::part(primary)` (the input chip's primary action overlay): background tint and outline. An unset style keeps the source's
    /// focus-visible ring (solid while focused); unset colour / width / offset keep its secondary / 3 / -3 (gate-7 R4-09).
    public let primaryBackground: String?, primaryOutlineStyle: String?, primaryOutlineColor: String?, primaryOutlineWidth: Double?, primaryOutlineOffset: Double?
    public init(stateLayerColor: String? = nil, stateLayerOpacity: Double? = nil, outlineColor: String? = nil, outlineWidth: Double? = nil,
                labelColor: String? = nil, iconColor: String? = nil, trailingIconColor: String? = nil, checkmarkColor: String? = nil, removeColor: String? = nil,
                primaryBackground: String? = nil, primaryOutlineStyle: String? = nil, primaryOutlineColor: String? = nil, primaryOutlineWidth: Double? = nil, primaryOutlineOffset: Double? = nil) {
        self.primaryBackground = awcChipColor(primaryBackground); self.primaryOutlineStyle = primaryOutlineStyle.flatMap { ["none", "solid"].contains($0) ? $0 : nil }
        self.primaryOutlineColor = awcChipColor(primaryOutlineColor); self.primaryOutlineWidth = primaryOutlineWidth.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.primaryOutlineOffset = primaryOutlineOffset.flatMap { $0.isFinite ? $0 : nil }
        self.stateLayerColor = awcChipColor(stateLayerColor); self.stateLayerOpacity = stateLayerOpacity.flatMap { $0.isFinite ? min(1, max(0, $0)) : nil }
        self.outlineColor = awcChipColor(outlineColor); self.outlineWidth = outlineWidth.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.labelColor = awcChipColor(labelColor); self.iconColor = awcChipColor(iconColor); self.trailingIconColor = awcChipColor(trailingIconColor)
        self.checkmarkColor = awcChipColor(checkmarkColor); self.removeColor = awcChipColor(removeColor)
    }
    public init(values: [String: AWCValue]) {
        func t(_ k: String) -> String? { values[k]?.string }
        self.init(stateLayerColor: t("stateLayerColor"), stateLayerOpacity: values["stateLayerOpacity"]?.number, outlineColor: t("outlineColor"),
                  outlineWidth: values["outlineWidth"]?.number, labelColor: t("labelColor"), iconColor: t("iconColor"), trailingIconColor: t("trailingIconColor"),
                  checkmarkColor: t("checkmarkColor"), removeColor: t("removeColor"), primaryBackground: t("primaryBackground"), primaryOutlineStyle: t("primaryOutlineStyle"),
                  primaryOutlineColor: t("primaryOutlineColor"), primaryOutlineWidth: values["primaryOutlineWidth"]?.number, primaryOutlineOffset: values["primaryOutlineOffset"]?.number)
    }
    public func merging(_ o: Self) -> Self {
        .init(stateLayerColor: o.stateLayerColor ?? stateLayerColor, stateLayerOpacity: o.stateLayerOpacity ?? stateLayerOpacity, outlineColor: o.outlineColor ?? outlineColor,
              outlineWidth: o.outlineWidth ?? outlineWidth, labelColor: o.labelColor ?? labelColor, iconColor: o.iconColor ?? iconColor,
              trailingIconColor: o.trailingIconColor ?? trailingIconColor, checkmarkColor: o.checkmarkColor ?? checkmarkColor, removeColor: o.removeColor ?? removeColor,
              primaryBackground: o.primaryBackground ?? primaryBackground, primaryOutlineStyle: o.primaryOutlineStyle ?? primaryOutlineStyle, primaryOutlineColor: o.primaryOutlineColor ?? primaryOutlineColor,
              primaryOutlineWidth: o.primaryOutlineWidth ?? primaryOutlineWidth, primaryOutlineOffset: o.primaryOutlineOffset ?? primaryOutlineOffset)
    }
}

private struct AWCChipHookAppearanceKey: EnvironmentKey { static let defaultValue = AWCChipHookAppearance() }
private struct AWCChipHookAppearanceTargetsKey: EnvironmentKey { static let defaultValue: [String: AWCChipHookAppearance] = [:] }
private struct AWCChipPartAppearanceKey: EnvironmentKey { static let defaultValue = AWCChipPartAppearance() }
private struct AWCChipPartAppearanceTargetsKey: EnvironmentKey { static let defaultValue: [String: AWCChipPartAppearance] = [:] }
private struct AWCChipReducedMotionKey: EnvironmentKey { static let defaultValue: Bool? = nil }
private struct AWCChipStretchKey: EnvironmentKey { static let defaultValue = false }
extension EnvironmentValues {
    var awcChipAppearance: AWCChipHookAppearance { get { self[AWCChipHookAppearanceKey.self] } set { self[AWCChipHookAppearanceKey.self] = newValue } }
    var awcChipAppearanceTargets: [String: AWCChipHookAppearance] { get { self[AWCChipHookAppearanceTargetsKey.self] } set { self[AWCChipHookAppearanceTargetsKey.self] = newValue } }
    var awcChipPartAppearance: AWCChipPartAppearance { get { self[AWCChipPartAppearanceKey.self] } set { self[AWCChipPartAppearanceKey.self] = newValue } }
    var awcChipPartAppearanceTargets: [String: AWCChipPartAppearance] { get { self[AWCChipPartAppearanceTargetsKey.self] } set { self[AWCChipPartAppearanceTargetsKey.self] = newValue } }
    /// Overrides the system reduce-motion setting for chip transitions (tests, previews).
    var awcChipReducedMotion: Bool? { get { self[AWCChipReducedMotionKey.self] } set { self[AWCChipReducedMotionKey.self] = newValue } }
    /// A chip that fills the width proposed to it (CSS: a chip given an inline size or stretched).
    var awcChipStretch: Bool { get { self[AWCChipStretchKey.self] } set { self[AWCChipStretchKey.self] = newValue } }
}
private struct AWCChipHookAppearanceModifier: ViewModifier {
    let value: AWCChipHookAppearance, id: String?
    @Environment(\.awcChipAppearance) private var inherited
    @Environment(\.awcChipAppearanceTargets) private var targets
    func body(content: Content) -> some View {
        if let id { var t = targets; t[id] = (t[id] ?? .init()).merging(value); return AnyView(content.environment(\.awcChipAppearanceTargets, t)) }
        return AnyView(content.environment(\.awcChipAppearance, inherited.merging(value)))
    }
}
private struct AWCChipPartAppearanceModifier: ViewModifier {
    let value: AWCChipPartAppearance, id: String?
    @Environment(\.awcChipPartAppearance) private var inherited
    @Environment(\.awcChipPartAppearanceTargets) private var targets
    func body(content: Content) -> some View {
        if let id { var t = targets; t[id] = (t[id] ?? .init()).merging(value); return AnyView(content.environment(\.awcChipPartAppearanceTargets, t)) }
        return AnyView(content.environment(\.awcChipPartAppearance, inherited.merging(value)))
    }
}
public extension View {
    /// Applies md-chip hook values to descendant chips, or to the chip with `id`.
    func awcChipAppearance(_ value: AWCChipHookAppearance, for id: String? = nil) -> some View { modifier(AWCChipHookAppearanceModifier(value: value, id: id)) }
    /// Applies `::part()` styling to descendant chips, or to the chip with `id`.
    func awcChipPartAppearance(_ value: AWCChipPartAppearance, for id: String? = nil) -> some View { modifier(AWCChipPartAppearanceModifier(value: value, id: id)) }
    /// Forces reduced (or full) motion for descendant chips, overriding the system setting.
    func awcChipReducedMotion(_ reduced: Bool?) -> some View { environment(\.awcChipReducedMotion, reduced) }
    /// Descendant chips fill the width proposed to them, aligning their content with `contentAlign`
    /// (the source's chip given an inline size, a grid column or `align-self: stretch`).
    func awcChipStretch(_ stretch: Bool = true) -> some View { environment(\.awcChipStretch, stretch) }
}
