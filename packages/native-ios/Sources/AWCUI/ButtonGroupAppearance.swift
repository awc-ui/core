import SwiftUI

/// The seven public md-button-group layout hooks, expressed in native points.
public struct AWCButtonGroupAppearance: Equatable, Sendable {
    public let gap: Double?
    public let width: Double?
    public let minWidth: Double?
    public let maxWidth: Double?
    public let height: Double?
    public let minHeight: Double?
    public let maxHeight: Double?
    public init(gap: Double? = nil, width: Double? = nil, minWidth: Double? = nil, maxWidth: Double? = nil, height: Double? = nil, minHeight: Double? = nil, maxHeight: Double? = nil) {
        self.gap = Self.number(gap)
        self.width = Self.number(width)
        self.minWidth = Self.number(minWidth)
        self.maxWidth = Self.number(maxWidth)
        self.height = Self.number(height)
        self.minHeight = Self.number(minHeight)
        self.maxHeight = Self.number(maxHeight)
    }
    public init(values: [String: AWCValue]) {
        func number(_ key: String) -> Double? { guard case .number(let value) = values[key] else { return nil }; return value }
        self.init(gap: number("gap"), width: number("width"), minWidth: number("minWidth"), maxWidth: number("maxWidth"), height: number("height"), minHeight: number("minHeight"), maxHeight: number("maxHeight"))
    }
    public func merging(_ local: AWCButtonGroupAppearance) -> AWCButtonGroupAppearance {
        .init(gap: local.gap ?? gap, width: local.width ?? width, minWidth: local.minWidth ?? minWidth, maxWidth: local.maxWidth ?? maxWidth, height: local.height ?? height, minHeight: local.minHeight ?? minHeight, maxHeight: local.maxHeight ?? maxHeight)
    }
    private static func number(_ value: Double?) -> Double? {
        guard let value, value.isFinite, (0...2400).contains(value) else { return nil }; return value
    }
}
private struct AWCButtonGroupAppearanceKey: EnvironmentKey { static let defaultValue = AWCButtonGroupAppearance() }
public extension EnvironmentValues {
    var awcButtonGroupAppearance: AWCButtonGroupAppearance {
        get { self[AWCButtonGroupAppearanceKey.self] }
        set { self[AWCButtonGroupAppearanceKey.self] = newValue }
    }
}
private struct AWCButtonGroupAppearanceModifier: ViewModifier {
    @Environment(\.awcButtonGroupAppearance) private var inherited
    let appearance: AWCButtonGroupAppearance
    func body(content: Content) -> some View { content.environment(\.awcButtonGroupAppearance, inherited.merging(appearance)) }
}
public extension View {
    func awcButtonGroupAppearance(_ appearance: AWCButtonGroupAppearance) -> some View {
        modifier(AWCButtonGroupAppearanceModifier(appearance: appearance))
    }
}
