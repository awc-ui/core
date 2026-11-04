import SwiftUI

/// The Web density selectors set a shared, inherited token only for -1...-4.
/// A default/zero property does not reset the containing component's token.
enum AWCNativeDensity {
    static func resolve(_ value: Double?, inherited: Double) -> Double {
        if let value, [-1.0, -2, -3, -4].contains(value) { return value }
        return inherited.isFinite ? inherited : 0
    }
}

private struct AWCNativeDensityKey: EnvironmentKey { static let defaultValue = 0.0 }
// The global -2...-4 density rules also replace the spacing token. A -1
// descendant changes scale only, so this token must inherit independently.
private struct AWCNativeDenseInsetKey: EnvironmentKey { static let defaultValue = false }
// The small gap starts condensing at -3, one rung after the medium inset.
// Keep this inheritance independent: a local -1/-2 scale does not reset an
// inherited compact small-gap token installed by an outer -3/-4 scope.
private struct AWCNativeCompactSmallGapKey: EnvironmentKey { static let defaultValue = false }
// The spacing-token rung: -2...-4 replace the insets, -1 inherits them (list hybrid density).
private struct AWCNativeSpacingRungKey: EnvironmentKey { static let defaultValue = 0.0 }
extension EnvironmentValues {
    var awcNativeSpacingRung: Double {
        get { self[AWCNativeSpacingRungKey.self] }
        set { self[AWCNativeSpacingRungKey.self] = newValue }
    }
    var awcNativeCompactSmallGap: Bool {
        get { self[AWCNativeCompactSmallGapKey.self] }
        set { self[AWCNativeCompactSmallGapKey.self] = newValue }
    }
    var awcNativeDenseInset: Bool {
        get { self[AWCNativeDenseInsetKey.self] }
        set { self[AWCNativeDenseInsetKey.self] = newValue }
    }
    var awcNativeDensity: Double {
        get { self[AWCNativeDensityKey.self] }
        set { self[AWCNativeDensityKey.self] = newValue }
    }
}

private struct AWCNativeDensityModifier: ViewModifier {
    @Environment(\.awcNativeDensity) private var inherited
    @Environment(\.awcNativeDenseInset) private var inheritedInset
    @Environment(\.awcNativeCompactSmallGap) private var inheritedSmallGap
    @Environment(\.awcNativeSpacingRung) private var inheritedSpacingRung
    let value: Double
    func body(content: Content) -> some View {
        let scale=value.isFinite ? value:inherited
        content.environment(\.awcNativeDensity,scale)
            .environment(\.awcNativeDenseInset,scale <= -2 || inheritedInset)
            .environment(\.awcNativeCompactSmallGap,scale <= -3 || inheritedSmallGap)
            .environment(\.awcNativeSpacingRung,scale <= -2 ? scale : inheritedSpacingRung)
    }
}
public extension View {
    /// Supplies the inherited native density token. A component's explicit
    /// -1...-4 property overrides it; its default zero continues to inherit.
    /// Nonfinite inputs preserve the current scope.
    func awcDensity(_ value: Double) -> some View { modifier(AWCNativeDensityModifier(value:value)) }
}
