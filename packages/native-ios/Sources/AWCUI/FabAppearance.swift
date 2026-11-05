import SwiftUI
import Observation

/// The five public md-fab appearance hooks, resolved in native points.
public struct AWCFabAppearance: Equatable, Sendable {
    public let containerColor: String?
    public let iconColor: String?
    public let iconSize: Double?
    public let cornerRadius: Double?
    public let labelColor: String?
    public init(containerColor: String? = nil, iconColor: String? = nil, iconSize: Double? = nil, cornerRadius: Double? = nil, labelColor: String? = nil) {
        func color(_ value: String?) -> String? { guard let value, value.range(of:"^#[0-9a-fA-F]{6}$",options:.regularExpression) != nil else { return nil }; return value.uppercased() }
        func number(_ value: Double?) -> Double? { guard let value, value.isFinite, (0...2400).contains(value) else { return nil }; return value }
        self.containerColor=color(containerColor); self.iconColor=color(iconColor); self.iconSize=number(iconSize); self.cornerRadius=number(cornerRadius); self.labelColor=color(labelColor)
    }
    public init(values: [String: AWCValue]) {
        func number(_ key:String)->Double? { guard case .number(let value)=values[key] else { return nil }; return value }
        self.init(containerColor:values["containerColor"]?.string,iconColor:values["iconColor"]?.string,iconSize:number("iconSize"),cornerRadius:number("cornerRadius"),labelColor:values["labelColor"]?.string)
    }
    public func merging(_ local:AWCFabAppearance)->AWCFabAppearance { .init(containerColor:local.containerColor ?? containerColor,iconColor:local.iconColor ?? iconColor,iconSize:local.iconSize ?? iconSize,cornerRadius:local.cornerRadius ?? cornerRadius,labelColor:local.labelColor ?? labelColor) }
}
/// Attach one controller to one FAB. Temporary presentation never mutates the
/// authored icon or slot, and remains callable while the control is disabled.
@Observable public final class AWCFabController {
    public private(set) var menuIcon: String?
    public init() {}
    @MainActor public func setMenuIcon(_ icon: String?) async { menuIcon = icon.flatMap { $0.isEmpty ? nil : $0 } }
}
private struct AWCFabAppearanceKey: EnvironmentKey { static let defaultValue=AWCFabAppearance() }
private struct AWCFabControllerKey: EnvironmentKey { static let defaultValue: AWCFabController? = nil }
public extension EnvironmentValues {
    var awcFabAppearance: AWCFabAppearance { get { self[AWCFabAppearanceKey.self] } set { self[AWCFabAppearanceKey.self]=newValue } }
    var awcFabController: AWCFabController? { get { self[AWCFabControllerKey.self] } set { self[AWCFabControllerKey.self]=newValue } }
}
private struct AWCFabAppearanceModifier: ViewModifier {
    @Environment(\.awcFabAppearance) private var inherited
    let appearance: AWCFabAppearance
    func body(content:Content)->some View { content.environment(\.awcFabAppearance,inherited.merging(appearance)) }
}
public extension View {
    func awcFabAppearance(_ appearance: AWCFabAppearance)->some View { modifier(AWCFabAppearanceModifier(appearance:appearance)) }
    func awcFabController(_ controller: AWCFabController)->some View { environment(\.awcFabController,controller) }
}
