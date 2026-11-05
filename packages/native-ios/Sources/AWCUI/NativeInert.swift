import SwiftUI

/// Retained disclosure content still exists in the native hierarchy. Disabling
/// hit testing alone does not remove native responder bridges from keyboard
/// navigation, so the same inert bit must reach those bridges as well.
private struct AWCNativeInertKey: EnvironmentKey { static let defaultValue = false }
extension EnvironmentValues {
    var awcNativeInert: Bool {
        get { self[AWCNativeInertKey.self] }
        set { self[AWCNativeInertKey.self] = newValue }
    }
}
private struct AWCNativeInertModifier: ViewModifier {
    let inert: Bool
    @Environment(\.awcNativeInert) private var inherited
    func body(content: Content) -> some View {
        content.environment(\.awcNativeInert, inherited || inert)
            .disabled(inherited || inert).allowsHitTesting(!(inherited || inert))
            .accessibilityHidden(inherited || inert)
    }
}
extension View {
    func awcNativeInert(_ value: Bool) -> some View { modifier(AWCNativeInertModifier(inert: value)) }
}
