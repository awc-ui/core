import SwiftUI

/// CSS `@media (forced-colors: active)` for the components whose source declares forced-colors rules (md-divider, md-avatar,
/// md-card, md-dialog, md-accordion(+item)). macOS and iOS have no forced-palette mode, so a host opts in, as it does for the
/// progress/skeleton/table forced-colors flags; increased contrast alone never replaces authored colours. The palette holds
/// the CSS system colours the rules name; `.standard` is Chrome's forced palette (Chrome 153, `forced-colors: active`).
public struct AWCForcedColorPalette: Equatable, Sendable {
    public var canvas: String, canvasText: String, buttonFace: String, buttonText: String, buttonBorder: String
    public var grayText: String, highlight: String, highlightText: String, linkText: String
    public init(canvas: String, canvasText: String, buttonFace: String, buttonText: String, buttonBorder: String,
                grayText: String, highlight: String, highlightText: String, linkText: String) {
        self.canvas = canvas; self.canvasText = canvasText; self.buttonFace = buttonFace; self.buttonText = buttonText; self.buttonBorder = buttonBorder
        self.grayText = grayText; self.highlight = highlight; self.highlightText = highlightText; self.linkText = linkText
    }
    public static let standard = AWCForcedColorPalette(canvas: "#000000", canvasText: "#FFFFFF", buttonFace: "#000000", buttonText: "#FFFFFF",
                                                       buttonBorder: "#FFFFFF", grayText: "#3FF23F", highlight: "#00E6FFCC", highlightText: "#000000", linkText: "#FFFF00")
    /// The UA's forced background: the system Canvas colour keeping the authored alpha.
    func canvas(keepingAlphaOf hex: String) -> String {
        let a = Color(awcHex: hex).resolve(in: EnvironmentValues()).opacity
        return String(canvas.prefix(7)) + String(format: "%02X", Int((Double(a) * 255).rounded()))
    }
}
private struct AWCForcedColorsKey: EnvironmentKey { static let defaultValue: AWCForcedColorPalette? = nil }
public extension EnvironmentValues {
    /// `forced-colors: active` palette (nil = not forced).
    var awcForcedColors: AWCForcedColorPalette? { get { self[AWCForcedColorsKey.self] } set { self[AWCForcedColorsKey.self] = newValue } }
}
public extension View {
    /// Renders md-divider, md-avatar, md-card, md-dialog and md-accordion(+item) below with their forced-colors rules.
    func awcForcedColors(_ palette: AWCForcedColorPalette? = .standard) -> some View { environment(\.awcForcedColors, palette) }
}

/// A host `border: <width> solid <color>` that a forced-colors rule adds. With `box-sizing: border-box` (md-card,
/// md-accordion-item, the floating md-accordion) the content box shrinks inside a fixed width and an auto height grows;
/// with content-box sizing (the md-dialog container) the box grows around its fixed content width. `fill` covers the
/// corner seam between the inner shape and the border's inner edge.
struct AWCForcedHostBorder: ViewModifier {
    let width: CGFloat, color: String?, fill: String?, corners: AWCCornerShape
    func body(content: Content) -> some View {
        let shape = AWCNativeCornerShape(corners: corners)
        content.padding(color == nil ? 0 : width)
            .background { if color != nil, let fill { shape.fill(Color(awcHex: fill)) } }
            .overlay { if let color, width > 0 { shape.strokeBorder(Color(awcHex: color), lineWidth: width).allowsHitTesting(false) } }
    }
}
