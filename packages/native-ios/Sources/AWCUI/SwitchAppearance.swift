import SwiftUI
#if canImport(AppKit)
import AppKit
#endif

/// Whether the key event being routed is an OS auto-repeat (the selection controls act once per press).
@MainActor func awcSelectionKeyRepeat() -> Bool {
    #if canImport(AppKit)
    if let repeating = AWCNativeKeyRouting.repeating { return repeating }
    guard let event = NSApp.currentEvent, event.type == .keyDown else { return false }
    return event.isARepeat
    #else
    return false   // UIKit delivers one pressesBegan per physical press
    #endif
}

func awcSwitchColor(_ value: String?) -> String? {
    guard let value, value.range(of: "^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$", options: .regularExpression) != nil else { return nil }
    return value.uppercased()
}

/// The twelve public md-switch hooks (`--md-switch-*`). Track width replaces the
/// density-scaled default; track height is the density base (each rung trims 4,
/// floored at 16); handle size replaces the selected handle (unselected = 2/3,
/// pressed = 7/6 of it). Interaction and disabled rules still override the color
/// hooks where the source cascade does.
public struct AWCSwitchAppearance: Equatable, Sendable {
    public let trackWidth: Double?, trackHeight: Double?, handleSize: Double?
    public let trackColor: String?, trackOutlineColor: String?, handleColor: String?
    public let selectedTrackColor: String?, selectedHandleColor: String?
    public let iconColor: String?, selectedIconColor: String?, stateLayerColor: String?, focusRingColor: String?
    public init(trackWidth: Double? = nil, trackHeight: Double? = nil, handleSize: Double? = nil,
                trackColor: String? = nil, trackOutlineColor: String? = nil, handleColor: String? = nil,
                selectedTrackColor: String? = nil, selectedHandleColor: String? = nil,
                iconColor: String? = nil, selectedIconColor: String? = nil, stateLayerColor: String? = nil, focusRingColor: String? = nil) {
        func length(_ v: Double?) -> Double? { v.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil } }
        self.trackWidth = length(trackWidth); self.trackHeight = length(trackHeight); self.handleSize = length(handleSize)
        self.trackColor = awcSwitchColor(trackColor); self.trackOutlineColor = awcSwitchColor(trackOutlineColor); self.handleColor = awcSwitchColor(handleColor)
        self.selectedTrackColor = awcSwitchColor(selectedTrackColor); self.selectedHandleColor = awcSwitchColor(selectedHandleColor)
        self.iconColor = awcSwitchColor(iconColor); self.selectedIconColor = awcSwitchColor(selectedIconColor)
        self.stateLayerColor = awcSwitchColor(stateLayerColor); self.focusRingColor = awcSwitchColor(focusRingColor)
    }
    public init(values: [String: AWCValue]) {
        func t(_ k: String) -> String? { values[k]?.string.isEmpty == false ? values[k]?.string : nil }
        self.init(trackWidth: values["trackWidth"]?.number, trackHeight: values["trackHeight"]?.number, handleSize: values["handleSize"]?.number,
                  trackColor: t("trackColor"), trackOutlineColor: t("trackOutlineColor"), handleColor: t("handleColor"),
                  selectedTrackColor: t("selectedTrackColor"), selectedHandleColor: t("selectedHandleColor"),
                  iconColor: t("iconColor"), selectedIconColor: t("selectedIconColor"), stateLayerColor: t("stateLayerColor"), focusRingColor: t("focusRingColor"))
    }
    public func merging(_ o: Self) -> Self {
        .init(trackWidth: o.trackWidth ?? trackWidth, trackHeight: o.trackHeight ?? trackHeight, handleSize: o.handleSize ?? handleSize,
              trackColor: o.trackColor ?? trackColor, trackOutlineColor: o.trackOutlineColor ?? trackOutlineColor, handleColor: o.handleColor ?? handleColor,
              selectedTrackColor: o.selectedTrackColor ?? selectedTrackColor, selectedHandleColor: o.selectedHandleColor ?? selectedHandleColor,
              iconColor: o.iconColor ?? iconColor, selectedIconColor: o.selectedIconColor ?? selectedIconColor,
              stateLayerColor: o.stateLayerColor ?? stateLayerColor, focusRingColor: o.focusRingColor ?? focusRingColor)
    }
}

/// `::part(track|handle|icon|state-layer)` styling. Part rules come from the outer
/// tree, so they win over the hooks and every internal state and disabled rule.
public struct AWCSwitchPartAppearance: Equatable, Sendable {
    public let trackColor: String?, trackOutlineColor: String?, trackShape: AWCCornerShape?
    public let handleColor: String?, handleShape: AWCCornerShape?, handleOpacity: Double?
    public let iconColor: String?, stateLayerColor: String?
    public init(trackColor: String? = nil, trackOutlineColor: String? = nil, trackShape: AWCCornerShape? = nil,
                handleColor: String? = nil, handleShape: AWCCornerShape? = nil, handleOpacity: Double? = nil,
                iconColor: String? = nil, stateLayerColor: String? = nil) {
        self.trackColor = awcSwitchColor(trackColor); self.trackOutlineColor = awcSwitchColor(trackOutlineColor); self.trackShape = trackShape.flatMap { $0.valid ? $0 : nil }
        self.handleColor = awcSwitchColor(handleColor); self.handleShape = handleShape.flatMap { $0.valid ? $0 : nil }
        self.handleOpacity = handleOpacity.flatMap { $0.isFinite ? min(1, max(0, $0)) : nil }
        self.iconColor = awcSwitchColor(iconColor); self.stateLayerColor = awcSwitchColor(stateLayerColor)
    }
    public init(values: [String: AWCValue]) {
        func shape(_ k: String) -> AWCCornerShape? { guard case .object(let v) = values[k] else { return nil }; return AWCCornerShape(values: v) }
        self.init(trackColor: values["trackColor"]?.string, trackOutlineColor: values["trackOutlineColor"]?.string, trackShape: shape("trackShape"),
                  handleColor: values["handleColor"]?.string, handleShape: shape("handleShape"), handleOpacity: values["handleOpacity"]?.number,
                  iconColor: values["iconColor"]?.string, stateLayerColor: values["stateLayerColor"]?.string)
    }
    public func merging(_ o: Self) -> Self {
        .init(trackColor: o.trackColor ?? trackColor, trackOutlineColor: o.trackOutlineColor ?? trackOutlineColor, trackShape: o.trackShape ?? trackShape,
              handleColor: o.handleColor ?? handleColor, handleShape: o.handleShape ?? handleShape, handleOpacity: o.handleOpacity ?? handleOpacity,
              iconColor: o.iconColor ?? iconColor, stateLayerColor: o.stateLayerColor ?? stateLayerColor)
    }
}

private struct AWCSwitchAppearanceKey: EnvironmentKey { static let defaultValue = AWCSwitchAppearance() }
private struct AWCSwitchAppearanceTargetsKey: EnvironmentKey { static let defaultValue: [String: AWCSwitchAppearance] = [:] }
private struct AWCSwitchPartAppearanceKey: EnvironmentKey { static let defaultValue = AWCSwitchPartAppearance() }
private struct AWCSwitchPartAppearanceTargetsKey: EnvironmentKey { static let defaultValue: [String: AWCSwitchPartAppearance] = [:] }
private struct AWCSelectionReducedMotionKey: EnvironmentKey { static let defaultValue: Bool? = nil }
extension EnvironmentValues {
    var awcSwitchAppearance: AWCSwitchAppearance { get { self[AWCSwitchAppearanceKey.self] } set { self[AWCSwitchAppearanceKey.self] = newValue } }
    var awcSwitchAppearanceTargets: [String: AWCSwitchAppearance] { get { self[AWCSwitchAppearanceTargetsKey.self] } set { self[AWCSwitchAppearanceTargetsKey.self] = newValue } }
    var awcSwitchPartAppearance: AWCSwitchPartAppearance { get { self[AWCSwitchPartAppearanceKey.self] } set { self[AWCSwitchPartAppearanceKey.self] = newValue } }
    var awcSwitchPartAppearanceTargets: [String: AWCSwitchPartAppearance] { get { self[AWCSwitchPartAppearanceTargetsKey.self] } set { self[AWCSwitchPartAppearanceTargetsKey.self] = newValue } }
    /// Overrides the system reduce-motion setting for switch/checkbox/radio transitions (tests, previews).
    var awcSelectionReducedMotion: Bool? { get { self[AWCSelectionReducedMotionKey.self] } set { self[AWCSelectionReducedMotionKey.self] = newValue } }
}
private struct AWCSwitchAppearanceModifier: ViewModifier {
    let value: AWCSwitchAppearance, id: String?
    @Environment(\.awcSwitchAppearance) private var inherited
    @Environment(\.awcSwitchAppearanceTargets) private var targets
    func body(content: Content) -> some View {
        if let id { var t = targets; t[id] = (t[id] ?? .init()).merging(value); return AnyView(content.environment(\.awcSwitchAppearanceTargets, t)) }
        return AnyView(content.environment(\.awcSwitchAppearance, inherited.merging(value)))
    }
}
private struct AWCSwitchPartAppearanceModifier: ViewModifier {
    let value: AWCSwitchPartAppearance, id: String?
    @Environment(\.awcSwitchPartAppearance) private var inherited
    @Environment(\.awcSwitchPartAppearanceTargets) private var targets
    func body(content: Content) -> some View {
        if let id { var t = targets; t[id] = (t[id] ?? .init()).merging(value); return AnyView(content.environment(\.awcSwitchPartAppearanceTargets, t)) }
        return AnyView(content.environment(\.awcSwitchPartAppearance, inherited.merging(value)))
    }
}
public extension View {
    /// Applies md-switch hook values to descendant switches, or to the switch with `id`.
    func awcSwitchAppearance(_ value: AWCSwitchAppearance, for id: String? = nil) -> some View { modifier(AWCSwitchAppearanceModifier(value: value, id: id)) }
    /// Applies `::part(track|handle|icon|state-layer)` styling to descendant switches, or to the switch with `id`.
    func awcSwitchPartAppearance(_ value: AWCSwitchPartAppearance, for id: String? = nil) -> some View { modifier(AWCSwitchPartAppearanceModifier(value: value, id: id)) }
    /// Forces reduced (or full) motion for descendant selection controls, overriding the system setting.
    func awcSelectionReducedMotion(_ reduced: Bool?) -> some View { environment(\.awcSelectionReducedMotion, reduced) }
}
