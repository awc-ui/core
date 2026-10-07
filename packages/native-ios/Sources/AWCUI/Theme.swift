import SwiftUI

public struct AWCTheme: Sendable {
    public var primary: Color
    public var secondary: Color
    public var tertiary: Color
    public var error: Color
    public var surface: Color
    public var onPrimary: Color
    public var onSurface: Color
    public init(primary: Color = Color(red: 0.36, green: 0.32, blue: 0.65), secondary: Color = Color(red: 0.38, green: 0.37, blue: 0.47), tertiary: Color = Color(red: 0.50, green: 0.32, blue: 0.44), error: Color = Color(red: 0.73, green: 0.15, blue: 0.15)) {
        self.primary = primary; self.secondary = secondary; self.tertiary = tertiary; self.error = error
        self.surface = Color(awcHex: "#F3EDF7"); self.onPrimary = .white; self.onSurface = Color(awcHex: "#1C1B1F")
    }
    public static func generated(dark: Bool = false) -> AWCTheme {
        let tokens = dark ? AWCGeneratedTokens.dark : AWCGeneratedTokens.light
        func color(_ key: String, _ fallback: String) -> Color { Color(awcHex: tokens["--md-sys-color-" + key] ?? fallback) }
        var value = AWCTheme(primary: color("primary", dark ? "#D0BCFF" : "#6750A4"), secondary: color("secondary", "#625B71"), tertiary: color("tertiary", "#7D5260"), error: color("error", "#B3261E"))
        value.surface = color("surface-container", dark ? "#211F26" : "#F3EDF7")
        value.onPrimary = color("on-primary", dark ? "#381E72" : "#FFFFFF")
        value.onSurface = color("on-surface", dark ? "#E6E1E5" : "#1C1B1F")
        return value
    }
}
private struct AWCThemeKey: EnvironmentKey { static let defaultValue: AWCTheme? = nil }
public extension EnvironmentValues {
    var awcTheme: AWCTheme? {
        get { self[AWCThemeKey.self] }
        set { self[AWCThemeKey.self] = newValue }
    }
}
public extension View {
    func awcTheme(_ theme: AWCTheme) -> some View { environment(\.awcTheme, theme) }
}

extension Color {
    init(awcHex: String) {
        let hex = awcHex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        let value = UInt64(hex, radix: 16) ?? 0x6750A4
        self.init(.sRGB, red: Double((value >> 16) & 255) / 255, green: Double((value >> 8) & 255) / 255, blue: Double(value & 255) / 255, opacity: 1)
    }
}

func awcSymbol(_ source: String) -> String {
    let symbols = ["arrow_drop_down": "chevron.down", "keyboard_arrow_down": "chevron.down", "calendar_today": "calendar", "more_horiz": "ellipsis", "priority_high": "exclamationmark", "keyboard_double_arrow_right": "chevron.right.2", "keyboard_double_arrow_left": "chevron.left.2", "add": "plus", "close": "xmark", "check": "checkmark", "menu": "line.3.horizontal", "search": "magnifyingglass", "settings": "gearshape", "favorite": "heart.fill", "home": "house", "person": "person.crop.circle", "star": "star.fill", "star_border": "star", "chevron_right": "chevron.right", "chevron_left": "chevron.left", "expand_more": "chevron.down", "expand_less": "chevron.up", "arrow_back": "arrow.left", "arrow_forward": "arrow.right", "more_vert": "ellipsis", "notifications": "bell", "edit": "pencil", "delete": "trash", "download": "arrow.down.to.line", "upload": "arrow.up.to.line", "share": "square.and.arrow.up", "info": "info.circle", "warning": "exclamationmark.triangle", "error": "exclamationmark.circle", "calendar_month": "calendar", "schedule": "clock", "visibility": "eye", "visibility_off": "eye.slash", "mail": "envelope", "folder": "folder", "filter_list": "line.3.horizontal.decrease", "sort": "arrow.up.arrow.down", "shopping_cart": "cart", "logout": "rectangle.portrait.and.arrow.right", "play_arrow": "play.fill", "pause": "pause.fill"]
    return symbols[source] ?? (source.isEmpty ? "circle" : source)
}


struct AWCActionStyle: ButtonStyle {
    var primary: Bool = false
    var theme: AWCTheme
    @Environment(\.isEnabled) private var enabled
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.font(.callout.weight(.semibold)).padding(.horizontal, 16).padding(.vertical, 10)
            .foregroundStyle(primary ? theme.onPrimary : theme.primary)
            .background(primary ? theme.primary : theme.primary.opacity(0.08), in: Capsule())
            .opacity(enabled ? configuration.isPressed ? 0.72 : 1 : 0.4)
    }
}

import SwiftUI
import Observation

@Observable
final class AWCInteractionStore {
    var radioValues: [String: String] = [:]
    var tabIndices: [String: Int] = [:]
}
private struct AWCInteractionStoreKey: EnvironmentKey { static let defaultValue: AWCInteractionStore? = nil }
extension EnvironmentValues {
    var awcInteractionStore: AWCInteractionStore? {
        get { self[AWCInteractionStoreKey.self] }
        set { self[AWCInteractionStoreKey.self] = newValue }
    }
}

/// Shares radio-name groups and tabs/panels linkage between otherwise separate native trees.
/// Nested children in one AWCNativeView already share an interaction scope automatically.
public struct AWCNativeScope<Content: View>: View {
    @State private var store = AWCInteractionStore()
    private let content: Content
    public init(@ViewBuilder content: () -> Content) { self.content = content() }
    public var body: some View { content.environment(\.awcInteractionStore, store) }
}
