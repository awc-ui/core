import SwiftUI

/// The seven public md-segmented-button style hooks, in logical points.
public struct AWCSegmentedButtonAppearance: Equatable, Sendable {
    public let containerColor: String?
    public let selectedContainerColor: String?
    public let labelColor: String?
    public let selectedLabelColor: String?
    public let outlineColor: String?
    public let cornerRadius: Double?
    public let iconSize: Double?
    public init(containerColor: String? = nil, selectedContainerColor: String? = nil,
                labelColor: String? = nil, selectedLabelColor: String? = nil,
                outlineColor: String? = nil, cornerRadius: Double? = nil, iconSize: Double? = nil) {
        func color(_ value: String?) -> String? {
            guard let value, value.range(of: "^#[0-9a-fA-F]{6}$", options: .regularExpression) != nil else { return nil }
            return value.uppercased()
        }
        func length(_ value: Double?) -> Double? {
            guard let value, value.isFinite, (0...2400).contains(value) else { return nil }; return value
        }
        self.containerColor = color(containerColor); self.selectedContainerColor = color(selectedContainerColor)
        self.labelColor = color(labelColor); self.selectedLabelColor = color(selectedLabelColor)
        self.outlineColor = color(outlineColor); self.cornerRadius = length(cornerRadius); self.iconSize = length(iconSize)
    }
    public init(values: [String: AWCValue]) {
        func number(_ name: String) -> Double? { if case .number(let value) = values[name] { return value }; return nil }
        self.init(containerColor: values["containerColor"]?.string, selectedContainerColor: values["selectedContainerColor"]?.string,
                  labelColor: values["labelColor"]?.string, selectedLabelColor: values["selectedLabelColor"]?.string,
                  outlineColor: values["outlineColor"]?.string, cornerRadius: number("cornerRadius"), iconSize: number("iconSize"))
    }
    public func merging(_ local: Self) -> Self {
        .init(containerColor: local.containerColor ?? containerColor, selectedContainerColor: local.selectedContainerColor ?? selectedContainerColor,
              labelColor: local.labelColor ?? labelColor, selectedLabelColor: local.selectedLabelColor ?? selectedLabelColor,
              outlineColor: local.outlineColor ?? outlineColor, cornerRadius: local.cornerRadius ?? cornerRadius, iconSize: local.iconSize ?? iconSize)
    }
}
private struct AWCSegmentedAppearanceKey: EnvironmentKey { static let defaultValue = AWCSegmentedButtonAppearance() }
private struct AWCSegmentedOverridesKey: EnvironmentKey { static let defaultValue: [String: AWCSegmentedButtonAppearance] = [:] }
public extension EnvironmentValues {
    var awcSegmentedButtonAppearance: AWCSegmentedButtonAppearance {
        get { self[AWCSegmentedAppearanceKey.self] } set { self[AWCSegmentedAppearanceKey.self] = newValue }
    }
}
extension EnvironmentValues {
    var awcSegmentedButtonOverrides: [String: AWCSegmentedButtonAppearance] {
        get { self[AWCSegmentedOverridesKey.self] } set { self[AWCSegmentedOverridesKey.self] = newValue }
    }
}
private struct AWCSegmentedAppearanceModifier: ViewModifier {
    @Environment(\.awcSegmentedButtonAppearance) private var inherited
    @Environment(\.awcSegmentedButtonOverrides) private var overrides
    let appearance: AWCSegmentedButtonAppearance
    let nodeID: String?
    @ViewBuilder func body(content: Content) -> some View {
        if let nodeID {
            content.environment(\.awcSegmentedButtonOverrides, overrides.merging([nodeID: (overrides[nodeID] ?? .init()).merging(appearance)]) { _, new in new })
        } else { content.environment(\.awcSegmentedButtonAppearance, inherited.merging(appearance)) }
    }
}
public extension View {
    func awcSegmentedButtonAppearance(_ appearance: AWCSegmentedButtonAppearance, nodeID: String? = nil) -> some View {
        modifier(AWCSegmentedAppearanceModifier(appearance: appearance, nodeID: nodeID))
    }
}
