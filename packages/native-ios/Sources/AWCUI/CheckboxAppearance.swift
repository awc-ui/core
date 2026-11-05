import SwiftUI

/// The fourteen public md-checkbox hooks (`--md-checkbox-*`). Lengths are points; the container
/// shape is a corner shape; colours are `#RRGGBB`/`#RRGGBBAA`. The density-scaled defaults apply
/// where a hook is unset; the touch target hook is the density base (each rung trims 4, floor 32).
public struct AWCCheckboxAppearance: Equatable, Sendable {
    public let containerColor: String?, containerShape: AWCCornerShape?, containerSize: Double?, selectedContainerColor: String?
    public let outlineColor: String?, outlineWidth: Double?, iconColor: String?, iconSize: Double?
    public let stateLayerColor: String?, selectedStateLayerColor: String?, stateLayerSize: Double?, touchTargetSize: Double?
    public let supportingTextColor: String?, errorTextColor: String?
    public init(containerColor: String? = nil, containerShape: AWCCornerShape? = nil, containerSize: Double? = nil, selectedContainerColor: String? = nil,
                outlineColor: String? = nil, outlineWidth: Double? = nil, iconColor: String? = nil, iconSize: Double? = nil,
                stateLayerColor: String? = nil, selectedStateLayerColor: String? = nil, stateLayerSize: Double? = nil, touchTargetSize: Double? = nil,
                supportingTextColor: String? = nil, errorTextColor: String? = nil) {
        func length(_ v: Double?) -> Double? { v.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil } }
        self.containerColor = awcSwitchColor(containerColor); self.containerShape = containerShape.flatMap { $0.valid ? $0 : nil }
        self.containerSize = length(containerSize); self.selectedContainerColor = awcSwitchColor(selectedContainerColor)
        self.outlineColor = awcSwitchColor(outlineColor); self.outlineWidth = length(outlineWidth)
        self.iconColor = awcSwitchColor(iconColor); self.iconSize = length(iconSize)
        self.stateLayerColor = awcSwitchColor(stateLayerColor); self.selectedStateLayerColor = awcSwitchColor(selectedStateLayerColor)
        self.stateLayerSize = length(stateLayerSize); self.touchTargetSize = length(touchTargetSize)
        self.supportingTextColor = awcSwitchColor(supportingTextColor); self.errorTextColor = awcSwitchColor(errorTextColor)
    }
    public init(values: [String: AWCValue]) {
        func shape(_ k: String) -> AWCCornerShape? { guard case .object(let v) = values[k] else { return nil }; return AWCCornerShape(values: v) }
        self.init(containerColor: values["containerColor"]?.string, containerShape: shape("containerShape"), containerSize: values["containerSize"]?.number,
                  selectedContainerColor: values["selectedContainerColor"]?.string, outlineColor: values["outlineColor"]?.string, outlineWidth: values["outlineWidth"]?.number,
                  iconColor: values["iconColor"]?.string, iconSize: values["iconSize"]?.number, stateLayerColor: values["stateLayerColor"]?.string,
                  selectedStateLayerColor: values["selectedStateLayerColor"]?.string, stateLayerSize: values["stateLayerSize"]?.number,
                  touchTargetSize: values["touchTargetSize"]?.number, supportingTextColor: values["supportingTextColor"]?.string, errorTextColor: values["errorTextColor"]?.string)
    }
    public func merging(_ o: Self) -> Self {
        .init(containerColor: o.containerColor ?? containerColor, containerShape: o.containerShape ?? containerShape, containerSize: o.containerSize ?? containerSize,
              selectedContainerColor: o.selectedContainerColor ?? selectedContainerColor, outlineColor: o.outlineColor ?? outlineColor, outlineWidth: o.outlineWidth ?? outlineWidth,
              iconColor: o.iconColor ?? iconColor, iconSize: o.iconSize ?? iconSize, stateLayerColor: o.stateLayerColor ?? stateLayerColor,
              selectedStateLayerColor: o.selectedStateLayerColor ?? selectedStateLayerColor, stateLayerSize: o.stateLayerSize ?? stateLayerSize,
              touchTargetSize: o.touchTargetSize ?? touchTargetSize, supportingTextColor: o.supportingTextColor ?? supportingTextColor, errorTextColor: o.errorTextColor ?? errorTextColor)
    }
}

/// `::part(target|state-layer|container|icon|supporting-text)` styling: outer-tree rules win over the
/// hooks and every internal state, error and disabled rule (a state-layer opacity replaces the state opacities).
public struct AWCCheckboxPartAppearance: Equatable, Sendable {
    public let targetColor: String?, stateLayerColor: String?, stateLayerOpacity: Double?
    public let containerColor: String?, containerOutlineColor: String?, containerShape: AWCCornerShape?
    public let iconColor: String?, supportingTextColor: String?
    public init(targetColor: String? = nil, stateLayerColor: String? = nil, stateLayerOpacity: Double? = nil, containerColor: String? = nil,
                containerOutlineColor: String? = nil, containerShape: AWCCornerShape? = nil, iconColor: String? = nil, supportingTextColor: String? = nil) {
        self.targetColor = awcSwitchColor(targetColor); self.stateLayerColor = awcSwitchColor(stateLayerColor)
        self.stateLayerOpacity = stateLayerOpacity.flatMap { $0.isFinite ? min(1, max(0, $0)) : nil }
        self.containerColor = awcSwitchColor(containerColor); self.containerOutlineColor = awcSwitchColor(containerOutlineColor)
        self.containerShape = containerShape.flatMap { $0.valid ? $0 : nil }; self.iconColor = awcSwitchColor(iconColor); self.supportingTextColor = awcSwitchColor(supportingTextColor)
    }
    public func merging(_ o: Self) -> Self {
        .init(targetColor: o.targetColor ?? targetColor, stateLayerColor: o.stateLayerColor ?? stateLayerColor, stateLayerOpacity: o.stateLayerOpacity ?? stateLayerOpacity,
              containerColor: o.containerColor ?? containerColor, containerOutlineColor: o.containerOutlineColor ?? containerOutlineColor,
              containerShape: o.containerShape ?? containerShape, iconColor: o.iconColor ?? iconColor, supportingTextColor: o.supportingTextColor ?? supportingTextColor)
    }
}

private struct AWCCheckboxAppearanceKey: EnvironmentKey { static let defaultValue = AWCCheckboxAppearance() }
private struct AWCCheckboxPartAppearanceKey: EnvironmentKey { static let defaultValue = AWCCheckboxPartAppearance() }
extension EnvironmentValues {
    var awcCheckboxAppearance: AWCCheckboxAppearance { get { self[AWCCheckboxAppearanceKey.self] } set { self[AWCCheckboxAppearanceKey.self] = newValue } }
    var awcCheckboxPartAppearance: AWCCheckboxPartAppearance { get { self[AWCCheckboxPartAppearanceKey.self] } set { self[AWCCheckboxPartAppearanceKey.self] = newValue } }
}
private struct AWCCheckboxAppearanceModifier: ViewModifier {
    let value: AWCCheckboxAppearance
    @Environment(\.awcCheckboxAppearance) private var inherited
    func body(content: Content) -> some View { content.environment(\.awcCheckboxAppearance, inherited.merging(value)) }
}
private struct AWCCheckboxPartAppearanceModifier: ViewModifier {
    let value: AWCCheckboxPartAppearance
    @Environment(\.awcCheckboxPartAppearance) private var inherited
    func body(content: Content) -> some View { content.environment(\.awcCheckboxPartAppearance, inherited.merging(value)) }
}
public extension View {
    /// Applies md-checkbox hook values to descendant checkboxes.
    func awcCheckboxAppearance(_ value: AWCCheckboxAppearance) -> some View { modifier(AWCCheckboxAppearanceModifier(value: value)) }
    /// Applies `::part(...)` styling to descendant checkboxes.
    func awcCheckboxPartAppearance(_ value: AWCCheckboxPartAppearance) -> some View { modifier(AWCCheckboxPartAppearanceModifier(value: value)) }
}
