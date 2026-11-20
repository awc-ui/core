import SwiftUI

public struct AWCTheme: Sendable {
    public var primary: Color
    public var secondary: Color
    public var tertiary: Color
    public var error: Color
    public var surface: Color
    public var background: Color
    public var onPrimary: Color
    public var onSurface: Color
    /// Resolved source tokens, including non-color defaults used by native motion and shapes.
    public private(set) var tokens: [String: String] = [:]
    public init(primary: Color = Color(red: 0.36, green: 0.32, blue: 0.65), secondary: Color = Color(red: 0.38, green: 0.37, blue: 0.47), tertiary: Color = Color(red: 0.50, green: 0.32, blue: 0.44), error: Color = Color(red: 0.73, green: 0.15, blue: 0.15)) {
        self.primary = primary; self.secondary = secondary; self.tertiary = tertiary; self.error = error
        self.surface = Color(awcHex: "#F3EDF7"); self.background = .white; self.onPrimary = .white; self.onSurface = Color(awcHex: "#1C1B1F")
    }
    public static func generated(dark: Bool = false, tokens overrides: [String: String] = [:]) -> AWCTheme {
        let resolved = resolvedTokens(dark: dark, overrides: overrides)
        func color(_ key: String, _ fallback: String) -> Color { Color(awcHex: resolved["--md-sys-color-" + key] ?? fallback) }
        var value = AWCTheme(primary: color("primary", dark ? "#D0BCFF" : "#6750A4"), secondary: color("secondary", "#625B71"), tertiary: color("tertiary", "#7D5260"), error: color("error", "#B3261E"))
        value.surface = color("surface-container", dark ? "#211F26" : "#F3EDF7")
        value.background = color("surface", dark ? "#141218" : "#FEF7FF")
        value.onPrimary = color("on-primary", dark ? "#381E72" : "#FFFFFF")
        value.onSurface = color("on-surface", dark ? "#E6E1E5" : "#1C1B1F")
        value.tokens = resolved
        return value
    }

    static func resolvedTokens(dark: Bool, overrides: [String: String]) -> [String: String] {
        var resolved = dark ? AWCGeneratedTokens.dark : AWCGeneratedTokens.light
        for (name, value) in overrides where name.hasPrefix("--md-sys-color-")
            && name.count <= 96 && name.range(of: "^--md-sys-color-[A-Za-z][A-Za-z0-9-]*$", options: .regularExpression) != nil
            && value.range(of: "^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$", options: .regularExpression) != nil {
            resolved[name] = value.uppercased()
        }
        return resolved
    }
}
private struct AWCThemeKey: EnvironmentKey { static let defaultValue: AWCTheme? = nil }
private struct AWCThemeTokensKey: EnvironmentKey { static let defaultValue: [String: String] = [:] }
public extension EnvironmentValues {
    var awcTheme: AWCTheme? {
        get { self[AWCThemeKey.self] }
        set { self[AWCThemeKey.self] = newValue }
    }
    var awcThemeTokens: [String: String] {
        get { self[AWCThemeTokensKey.self] }
        set { self[AWCThemeTokensKey.self] = newValue }
    }
}
public extension View {
    func awcTheme(_ theme: AWCTheme) -> some View {
        environment(\.awcTheme, theme).environment(\.awcThemeTokens, theme.tokens)
    }
}

extension Color {
    init(awcHex: String) {
        let hex = awcHex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        let value = UInt64(hex, radix: 16) ?? 0x6750A4
        let rgba = hex.count == 8, rgb = rgba ? value >> 8 : value
        self.init(.sRGB, red: Double((rgb >> 16) & 255) / 255, green: Double((rgb >> 8) & 255) / 255, blue: Double(rgb & 255) / 255, opacity: rgba ? Double(value & 255) / 255 : 1)
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
    /// The accessible names of each md-tabs' tabs (a panel is named by its tab).
    var tabLabels: [String: [String]] = [:]
    /// Authored text by node id (aria-labelledby resolution).
    let labelTexts = AWCLabelTexts()
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

extension AWCTheme {
    /// The theme as forced colours paint md-accordion(+item): foreground roles (on-*, outline*, accent inks) become CanvasText,
    /// backgrounds (surfaces, containers) Canvas, `secondary` (the focus rings, `outline-color: Highlight` in the source)
    /// Highlight, and elevation shadows none.
    func awcForced(_ palette: AWCForcedColorPalette?) -> AWCTheme {
        guard let palette else { return self }
        var value = self, tokens = self.tokens
        for key in Array(tokens.keys) {
            if key.hasPrefix("--md-sys-color-") { tokens[key] = Self.forcedRole(String(key.dropFirst(15)), palette) }
            else if key.hasPrefix("--md-sys-elevation-") { tokens[key] = "none" }
        }
        value.tokens = tokens
        value.primary = Color(awcHex: palette.canvasText); value.secondary = Color(awcHex: palette.highlight); value.tertiary = Color(awcHex: palette.canvasText)
        value.error = Color(awcHex: palette.canvasText); value.surface = Color(awcHex: palette.canvas); value.background = Color(awcHex: palette.canvas)
        value.onPrimary = Color(awcHex: palette.canvas); value.onSurface = Color(awcHex: palette.canvasText)
        return value
    }
    static func forcedRole(_ role: String, _ p: AWCForcedColorPalette) -> String {
        if role == "secondary" { return p.highlight }
        let ink = role.hasPrefix("on-") || role.hasPrefix("inverse-on-") || role.hasPrefix("outline")
            || ["primary", "tertiary", "error", "inverse-primary", "primary-fixed-dim", "secondary-fixed-dim", "tertiary-fixed-dim"].contains(role)
        return ink ? p.canvasText : p.canvas
    }
}
