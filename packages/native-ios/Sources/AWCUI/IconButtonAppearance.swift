import SwiftUI

/// The nine public md-icon-button CSS hooks, in native points and #RRGGBB or #RRGGBBAA colors.
/// Nil inherits; invalid local values cannot erase a valid ancestor override.
public struct AWCIconButtonAppearance: Equatable, Sendable {
    public let containerColor: String?
    public let iconColor: String?
    public let stateLayerColor: String?
    public let iconSize: Double?
    public let cornerRadius: Double?
    public let outlineColor: String?
    public let outlineWidth: Double?
    public let width: Double?
    public let height: Double?

    public init(containerColor: String? = nil, iconColor: String? = nil, stateLayerColor: String? = nil, iconSize: Double? = nil, cornerRadius: Double? = nil, outlineColor: String? = nil, outlineWidth: Double? = nil, width: Double? = nil, height: Double? = nil) {
        self.containerColor = Self.hex(containerColor)
        self.iconColor = Self.hex(iconColor)
        self.stateLayerColor = Self.hex(stateLayerColor)
        self.iconSize = Self.number(iconSize, 0...2400)
        self.cornerRadius = Self.number(cornerRadius, 0...2400)
        self.outlineColor = Self.hex(outlineColor)
        self.outlineWidth = Self.number(outlineWidth, 0...16)
        self.width = Self.number(width, 0...2400)
        self.height = Self.number(height, 0...2400)
    }
    public init(values: [String: AWCValue]) {
        func text(_ key: String) -> String? { guard case .string(let value) = values[key] else { return nil }; return value }
        func number(_ key: String) -> Double? { guard case .number(let value) = values[key] else { return nil }; return value }
        self.init(containerColor: text("containerColor"), iconColor: text("iconColor"), stateLayerColor: text("stateLayerColor"), iconSize: number("iconSize"), cornerRadius: number("cornerRadius"), outlineColor: text("outlineColor"), outlineWidth: number("outlineWidth"), width: number("width"), height: number("height"))
    }
    public func merging(_ local: AWCIconButtonAppearance) -> AWCIconButtonAppearance {
        .init(containerColor: local.containerColor ?? containerColor, iconColor: local.iconColor ?? iconColor, stateLayerColor: local.stateLayerColor ?? stateLayerColor, iconSize: local.iconSize ?? iconSize, cornerRadius: local.cornerRadius ?? cornerRadius, outlineColor: local.outlineColor ?? outlineColor, outlineWidth: local.outlineWidth ?? outlineWidth, width: local.width ?? width, height: local.height ?? height)
    }
    private static func hex(_ value: String?) -> String? {
        guard let value, (value.utf8.count == 7 || value.utf8.count == 9), value.first == "#",
              value.dropFirst().utf8.allSatisfy({ (48...57).contains($0) || (65...70).contains($0) || (97...102).contains($0) }) else { return nil }
        return value.uppercased()
    }
    private static func number(_ value: Double?, _ range: ClosedRange<Double>) -> Double? {
        guard let value, value.isFinite, range.contains(value) else { return nil }; return value
    }
}
private struct AWCIconButtonAppearanceKey: EnvironmentKey { static let defaultValue = AWCIconButtonAppearance() }
public extension EnvironmentValues {
    var awcIconButtonAppearance: AWCIconButtonAppearance {
        get { self[AWCIconButtonAppearanceKey.self] }
        set { self[AWCIconButtonAppearanceKey.self] = newValue }
    }
}
private struct AWCIconButtonAppearanceModifier: ViewModifier {
    @Environment(\.awcIconButtonAppearance) private var inherited
    let appearance: AWCIconButtonAppearance
    func body(content: Content) -> some View { content.environment(\.awcIconButtonAppearance, inherited.merging(appearance)) }
}
public extension View {
    func awcIconButtonAppearance(_ appearance: AWCIconButtonAppearance) -> some View {
        modifier(AWCIconButtonAppearanceModifier(appearance: appearance))
    }
}
