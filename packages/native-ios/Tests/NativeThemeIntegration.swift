import AppKit
import SwiftUI
import AWCUI

/// Standalone contract check for hosts with Command Line Tools but no XCTest SDK.
/// Link against the built AWCUI module, like NativeBehaviorViewIntegration.swift.
@main enum NativeThemeIntegration {
    static func main() {
        var checks = 0
        func check(_ valid: Bool, _ message: String) {
            checks += 1
            precondition(valid, message)
        }
        func hex(_ color: Color) -> String {
            let value = NSColor(color).usingColorSpace(.sRGB)!
            return String(format: "#%02X%02X%02X", Int((value.redComponent * 255).rounded()), Int((value.greenComponent * 255).rounded()), Int((value.blueComponent * 255).rounded()))
        }
        for dark in [false, true] {
            let defaults = dark ? AWCGeneratedTokens.dark : AWCGeneratedTokens.light
            let original = AWCTheme.generated(dark: dark)
            check(original.tokens == defaults, "No overrides preserve the original generated token dictionary")
            let themed = AWCTheme.generated(dark: dark, tokens: [
                "--md-sys-color-primary": "#123abc", "--md-sys-color-on-primary": "#F1F2F3",
                "--md-sys-color-secondary-container": "#ABCDEF", "--md-sys-color-on-secondary-container": "#102030",
                "--md-sys-color-surface": "#AABBCC", "--md-sys-color-surface-container": "#BBDDEE",
                "--md-sys-color-on-surface": "#112233", "--md-sys-motion-duration-short1": "#FFFFFF",
                "--md-sys-color-error": "javascript:bad", "--md-sys-color-primary-container": "#AABBCCDD",
            ])
            check(hex(themed.primary) == "#123ABC", "Primary uses the supplied color")
            check(hex(themed.onPrimary) == "#F1F2F3", "On-primary uses the supplied color")
            check(hex(themed.background) == "#AABBCC", "Canvas surface differs from component surface-container")
            check(hex(themed.surface) == "#BBDDEE", "Existing surface property retains its container meaning")
            check(hex(themed.onSurface) == "#112233", "Foreground uses supplied on-surface")
            check(themed.tokens["--md-sys-color-secondary-container"] == "#ABCDEF", "Tonal button container resolves supplied secondary-container")
            check(themed.tokens["--md-sys-color-on-secondary-container"] == "#102030", "Tonal button label resolves supplied on-secondary-container")
            check(themed.tokens["--md-sys-motion-duration-short1"] == defaults["--md-sys-motion-duration-short1"], "Color overrides cannot change motion")
            check(themed.tokens["--md-sys-color-error"] == defaults["--md-sys-color-error"], "Invalid color is ignored")
            check(themed.tokens["--md-sys-color-primary-container"] == defaults["--md-sys-color-primary-container"], "Unsupported alpha format is ignored")
            var environment = EnvironmentValues()
            environment.awcThemeTokens = themed.tokens
            check(environment.awcThemeTokens["--md-sys-color-secondary-container"] == "#ABCDEF", "Resolved color roles survive environment propagation")
        }
        print("Passed \(checks) native theme token/color checks.")
    }
}
