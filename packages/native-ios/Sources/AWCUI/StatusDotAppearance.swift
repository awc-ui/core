import SwiftUI

/// A logical inset in points plus a fraction of the containing view's dimension.
/// Percentages use the parent, unlike a badge's transform offsets.
public struct AWCStatusDotInset: Equatable, Sendable {
    public let points: Double
    public let fraction: Double
    public init(points: Double = 0, fraction: Double = 0) {
        self.points = points; self.fraction = fraction
    }
    var isValid: Bool { points.isFinite && fraction.isFinite }
    func resolved(_ parentDimension: Double) -> Double { points + fraction * parentDimension }
}

/// The eight md-status-dot hooks. Durations use seconds; colors use RGB/RGBA hex.
public struct AWCStatusDotAppearance: Equatable, Sendable {
    public let size: Double?
    public let color: String?
    public let pulseColor: String?
    public let outlineColor: String?
    public let outlineWidth: Double?
    public let insetEnd: AWCStatusDotInset?
    public let insetBlockEnd: AWCStatusDotInset?
    public let pulseDuration: Double?

    public init(size: Double? = nil, color: String? = nil, pulseColor: String? = nil,
                outlineColor: String? = nil, outlineWidth: Double? = nil,
                insetEnd: AWCStatusDotInset? = nil, insetBlockEnd: AWCStatusDotInset? = nil,
                pulseDuration: Double? = nil) {
        func paint(_ value: String?) -> String? {
            value.flatMap { $0.range(of: "^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$", options: .regularExpression) == nil ? nil : $0.uppercased() }
        }
        func positive(_ value: Double?) -> Double? { value.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil } }
        self.size = positive(size); self.color = paint(color); self.pulseColor = paint(pulseColor)
        self.outlineColor = paint(outlineColor); self.outlineWidth = positive(outlineWidth)
        self.insetEnd = insetEnd.flatMap { $0.isValid ? $0 : nil }
        self.insetBlockEnd = insetBlockEnd.flatMap { $0.isValid ? $0 : nil }
        self.pulseDuration = positive(pulseDuration)
    }

    public init(values: [String: AWCValue]) {
        func number(_ key: String) -> Double? {
            guard case .number(let value) = values[key] else { return nil }; return value
        }
        func inset(_ key: String) -> AWCStatusDotInset? {
            guard case .object(let object) = values[key],
                  Set(object.keys).isSubset(of: ["points", "fraction"]) else { return nil }
            func member(_ key: String) -> Double? {
                guard let value = object[key] else { return 0 }
                guard case .number(let number) = value else { return nil }; return number
            }
            guard let points = member("points"), let fraction = member("fraction") else { return nil }
            return .init(points: points, fraction: fraction)
        }
        self.init(size: number("size"), color: values["color"]?.string,
            pulseColor: values["pulseColor"]?.string, outlineColor: values["outlineColor"]?.string,
            outlineWidth: number("outlineWidth"), insetEnd: inset("insetEnd"),
            insetBlockEnd: inset("insetBlockEnd"), pulseDuration: number("pulseDuration"))
    }

    public func merging(_ local: Self) -> Self {
        .init(size: local.size ?? size, color: local.color ?? color, pulseColor: local.pulseColor ?? pulseColor,
            outlineColor: local.outlineColor ?? outlineColor, outlineWidth: local.outlineWidth ?? outlineWidth,
            insetEnd: local.insetEnd ?? insetEnd, insetBlockEnd: local.insetBlockEnd ?? insetBlockEnd,
            pulseDuration: local.pulseDuration ?? pulseDuration)
    }
}

private struct AWCStatusDotAppearanceKey: EnvironmentKey { static let defaultValue = AWCStatusDotAppearance() }
public extension EnvironmentValues {
    var awcStatusDotAppearance: AWCStatusDotAppearance {
        get { self[AWCStatusDotAppearanceKey.self] }
        set { self[AWCStatusDotAppearanceKey.self] = newValue }
    }
}
private struct AWCStatusDotAppearanceModifier: ViewModifier {
    @Environment(\.awcStatusDotAppearance) private var inherited
    let appearance: AWCStatusDotAppearance
    func body(content: Content) -> some View {
        content.environment(\.awcStatusDotAppearance, inherited.merging(appearance))
    }
}
public extension View {
    func awcStatusDotAppearance(_ appearance: AWCStatusDotAppearance) -> some View {
        modifier(AWCStatusDotAppearanceModifier(appearance: appearance))
    }
}
