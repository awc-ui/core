import SwiftUI

/// The four public md-divider style hooks. Lengths are native points.
public struct AWCDividerAppearance: Equatable, Sendable {
    public let color: String?
    public let thickness: Double?
    public let insetStart: Double?
    public let insetEnd: Double?

    public init(color: String? = nil, thickness: Double? = nil, insetStart: Double? = nil, insetEnd: Double? = nil) {
        self.color = color.flatMap { $0.range(of: "^#[0-9a-fA-F]{6}$", options: .regularExpression) == nil ? nil : $0.uppercased() }
        self.thickness = thickness.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
        self.insetStart = insetStart.flatMap { $0.isFinite ? $0 : nil }
        self.insetEnd = insetEnd.flatMap { $0.isFinite ? $0 : nil }
    }

    public init(values: [String: AWCValue]) {
        func number(_ key: String) -> Double? {
            guard case .number(let value) = values[key] else { return nil }
            return value
        }
        self.init(color: values["color"]?.string, thickness: number("thickness"),
                  insetStart: number("insetStart"), insetEnd: number("insetEnd"))
    }

    public func merging(_ local: AWCDividerAppearance) -> AWCDividerAppearance {
        .init(color: local.color ?? color, thickness: local.thickness ?? thickness,
              insetStart: local.insetStart ?? insetStart, insetEnd: local.insetEnd ?? insetEnd)
    }
}

private struct AWCDividerAppearanceKey: EnvironmentKey {
    static let defaultValue = AWCDividerAppearance()
}
public extension EnvironmentValues {
    var awcDividerAppearance: AWCDividerAppearance {
        get { self[AWCDividerAppearanceKey.self] }
        set { self[AWCDividerAppearanceKey.self] = newValue }
    }
}
private struct AWCDividerAppearanceModifier: ViewModifier {
    @Environment(\.awcDividerAppearance) private var inherited
    let appearance: AWCDividerAppearance
    func body(content: Content) -> some View {
        content.environment(\.awcDividerAppearance, inherited.merging(appearance))
    }
}
public extension View {
    func awcDividerAppearance(_ appearance: AWCDividerAppearance) -> some View {
        modifier(AWCDividerAppearanceModifier(appearance: appearance))
    }
}
