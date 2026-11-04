import SwiftUI

/// A translation in points plus a fraction of the badge's own width or height.
/// For example, `.init(points: 7, fraction: 0.5)` matches `calc(50% + 7px)`.
public struct AWCBadgeOffset: Equatable, Sendable {
    public let points: Double
    public let fraction: Double
    public init(points: Double = 0, fraction: Double = 0) {
        self.points = points
        self.fraction = fraction
    }
    var isValid: Bool { points.isFinite && fraction.isFinite }
    func resolved(_ length: Double) -> Double { points + fraction * length }
}

/// Physical top/right/bottom/left padding, matching CSS padding shorthand.
public struct AWCBadgePadding: Equatable, Sendable {
    public let top: Double
    public let right: Double
    public let bottom: Double
    public let left: Double
    public init(top: Double = 0, right: Double = 0, bottom: Double = 0, left: Double = 0) {
        self.top = top; self.right = right; self.bottom = bottom; self.left = left
    }
    var isValid: Bool { [top, right, bottom, left].allSatisfy { $0.isFinite && $0 >= 0 } }
}

/// The ten public md-badge appearance hooks, using resolved native lengths.
public struct AWCBadgeAppearance: Equatable, Sendable {
    public let containerColor: String?
    public let labelColor: String?
    public let cornerRadius: Double?
    public let iconColor: String?
    public let iconSize: Double?
    public let offsetX: AWCBadgeOffset?
    public let offsetY: AWCBadgeOffset?
    public let largeHeight: Double?
    public let largePadding: AWCBadgePadding?
    public let smallSize: Double?

    public init(containerColor: String? = nil, labelColor: String? = nil,
                cornerRadius: Double? = nil, iconColor: String? = nil, iconSize: Double? = nil,
                offsetX: AWCBadgeOffset? = nil, offsetY: AWCBadgeOffset? = nil,
                largeHeight: Double? = nil, largePadding: AWCBadgePadding? = nil, smallSize: Double? = nil) {
        func color(_ value: String?) -> String? {
            value.flatMap { $0.range(of: "^#[0-9a-fA-F]{6}$", options: .regularExpression) == nil ? nil : $0.uppercased() }
        }
        func length(_ value: Double?) -> Double? { value.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil } }
        self.containerColor = color(containerColor); self.labelColor = color(labelColor)
        self.cornerRadius = length(cornerRadius); self.iconColor = color(iconColor); self.iconSize = length(iconSize)
        self.offsetX = offsetX.flatMap { $0.isValid ? $0 : nil }
        self.offsetY = offsetY.flatMap { $0.isValid ? $0 : nil }
        self.largeHeight = length(largeHeight)
        self.largePadding = largePadding.flatMap { $0.isValid ? $0 : nil }
        self.smallSize = length(smallSize)
    }

    public init(values: [String: AWCValue]) {
        func number(_ value: AWCValue?) -> Double? {
            guard case .number(let value) = value else { return nil }
            return value
        }
        func offset(_ key: String) -> AWCBadgeOffset? {
            guard case .object(let object) = values[key],
                  Set(object.keys).isSubset(of: ["points", "fraction"]),
                  let points = object["points"].map({ number($0) }) ?? 0,
                  let fraction = object["fraction"].map({ number($0) }) ?? 0 else { return nil }
            return .init(points: points, fraction: fraction)
        }
        var padding: AWCBadgePadding?
        if case .array(let array) = values["largePadding"], array.count == 4 {
            let numbers = array.compactMap { number($0) }
            if numbers.count == 4 { padding = .init(top: numbers[0], right: numbers[1], bottom: numbers[2], left: numbers[3]) }
        }
        self.init(containerColor: values["containerColor"]?.string, labelColor: values["labelColor"]?.string,
                  cornerRadius: number(values["cornerRadius"]), iconColor: values["iconColor"]?.string,
                  iconSize: number(values["iconSize"]), offsetX: offset("offsetX"), offsetY: offset("offsetY"),
                  largeHeight: number(values["largeHeight"]), largePadding: padding, smallSize: number(values["smallSize"]))
    }

    public func merging(_ local: AWCBadgeAppearance) -> AWCBadgeAppearance {
        .init(containerColor: local.containerColor ?? containerColor, labelColor: local.labelColor ?? labelColor,
              cornerRadius: local.cornerRadius ?? cornerRadius, iconColor: local.iconColor ?? iconColor,
              iconSize: local.iconSize ?? iconSize, offsetX: local.offsetX ?? offsetX, offsetY: local.offsetY ?? offsetY,
              largeHeight: local.largeHeight ?? largeHeight, largePadding: local.largePadding ?? largePadding,
              smallSize: local.smallSize ?? smallSize)
    }
}

private struct AWCBadgeAppearanceKey: EnvironmentKey {
    static let defaultValue = AWCBadgeAppearance()
}
public extension EnvironmentValues {
    var awcBadgeAppearance: AWCBadgeAppearance {
        get { self[AWCBadgeAppearanceKey.self] }
        set { self[AWCBadgeAppearanceKey.self] = newValue }
    }
}
private struct AWCBadgeAppearanceModifier: ViewModifier {
    @Environment(\.awcBadgeAppearance) private var inherited
    let appearance: AWCBadgeAppearance
    func body(content: Content) -> some View {
        content.environment(\.awcBadgeAppearance, inherited.merging(appearance))
    }
}
public extension View {
    func awcBadgeAppearance(_ appearance: AWCBadgeAppearance) -> some View {
        modifier(AWCBadgeAppearanceModifier(appearance: appearance))
    }
}
