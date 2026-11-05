import SwiftUI
#if canImport(AppKit)
import AppKit
#elseif canImport(UIKit)
import UIKit
#endif

// Public native API of md-line-chart, md-area-chart, md-bar-chart, md-pie-chart and md-sparkline: typed hook appearances
// (the `--md-<chart>-*` custom properties, inherited like CSS — nearer values win, the host's own inline `style` wins over
// all) and the method controller. AWCHookText, awcEffectiveTokens and AWCHookAppearanceModifier are shared helpers.

/// The hook text of an appearance, by hook suffix, from typed values (lengths in points = CSS px, durations in ms).
struct AWCHookText {
    var css: [String: String] = [:]
    static func number(_ v: Double) -> String { !v.isFinite ? "invalid" : v == v.rounded() && abs(v) < 1e15 ? String(Int64(v)) : String(v) }
    mutating func text(_ suffix: String, _ v: String?) { if let v { css[suffix] = v } }
    mutating func px(_ suffix: String, _ v: Double?) { if let v { css[suffix] = v.isFinite ? Self.number(v) + "px" : "invalid" } }
    mutating func plain(_ suffix: String, _ v: Double?) { if let v { css[suffix] = Self.number(v) } }
    mutating func ms(_ suffix: String, _ v: Double?) { if let v { css[suffix] = v.isFinite ? Self.number(v) + "ms" : "invalid" } }
}

/// `#RRGGBB` (or `#RRGGBBAA` when translucent) for an inspected colour.
func awcChartHex(_ c: AWCChartRGBA) -> String {
    func b(_ v: Double) -> String { String(format: "%02X", Int((min(1, max(0, v)) * 255).rounded())) }
    return "#" + b(c.0) + b(c.1) + b(c.2) + (c.3 < 1 ? b(c.3) : "")
}

/// The effective custom properties a component reads: theme tokens, then the appearance hooks (full names), then the
/// custom properties of the host's inline `style` (the nearest declaration).
func awcEffectiveTokens(_ tokens: [String: String], hooks: [String: String], style: String?) -> [String: String] {
    var out = tokens
    for (k, v) in hooks { out[k] = v }
    for part in (style ?? "").split(separator: ";") {
        let kv = part.split(separator: ":", maxSplits: 1).map { $0.trimmingCharacters(in: .whitespaces) }
        if kv.count == 2, kv[0].hasPrefix("--") { out[kv[0]] = kv[1] }
    }
    return out
}

// MARK: - Charts

/// Typed `--md-<chart>-*` hooks shared by the five chart elements (each element reads the hooks its stylesheet declares:
/// sparkline: blockSize, inlineSize, minInlineSize; pie: no zoom hooks, centerColor).
public struct AWCChartAppearance: Equatable, Sendable {
    /// Hook text by suffix (`background`, `padding`, `zoom-track-color`, …).
    public let css: [String: String]
    static let suffixes = ["block-size", "min-block-size", "aspect-ratio", "background", "padding", "shape", "empty-color", "empty-background", "empty-font",
                           "empty-font-size", "empty-icon-size", "zoom-size", "zoom-track-color", "zoom-window-color", "zoom-handle-color", "zoom-band-color",
                           "center-color", "inline-size", "min-inline-size"]
    /// Colours `#RRGGBB`/`#RRGGBBAA` (any CSS colour text is accepted), lengths in points, `aspectRatio` as a CSS `<ratio>`
    /// (`16 / 9` or a number), `emptyFont` a font family.
    public init(blockSize: Double? = nil, minBlockSize: Double? = nil, aspectRatio: String? = nil, background: String? = nil, padding: Double? = nil,
                shape: Double? = nil, emptyColor: String? = nil, emptyBackground: String? = nil, emptyFont: String? = nil, emptyFontSize: Double? = nil,
                emptyIconSize: Double? = nil, zoomSize: Double? = nil, zoomTrackColor: String? = nil, zoomWindowColor: String? = nil,
                zoomHandleColor: String? = nil, zoomBandColor: String? = nil, centerColor: String? = nil, inlineSize: Double? = nil, minInlineSize: Double? = nil) {
        var h = AWCHookText()
        h.px("block-size", blockSize); h.px("min-block-size", minBlockSize); h.text("aspect-ratio", aspectRatio); h.text("background", background)
        h.px("padding", padding); h.px("shape", shape); h.text("empty-color", emptyColor); h.text("empty-background", emptyBackground)
        h.text("empty-font", emptyFont); h.px("empty-font-size", emptyFontSize); h.px("empty-icon-size", emptyIconSize); h.px("zoom-size", zoomSize)
        h.text("zoom-track-color", zoomTrackColor); h.text("zoom-window-color", zoomWindowColor); h.text("zoom-handle-color", zoomHandleColor)
        h.text("zoom-band-color", zoomBandColor); h.text("center-color", centerColor); h.px("inline-size", inlineSize); h.px("min-inline-size", minInlineSize)
        css = h.css
    }
    /// Raw custom-property text by suffix, exactly as the source reads it.
    public init(cssValues: [String: String]) { css = cssValues.filter { Self.suffixes.contains($0.key) } }
    /// Laboratory/source names (`blockSize`, `zoomTrackColor`, …; lengths as numbers in px).
    public init(values: [String: AWCValue]) {
        func n(_ k: String) -> Double? { values[k]?.number }
        func s(_ k: String) -> String? { values[k]?.string }
        self.init(blockSize: n("blockSize"), minBlockSize: n("minBlockSize"), aspectRatio: s("aspectRatio") ?? n("aspectRatio").map(AWCHookText.number),
                  background: s("background"), padding: n("padding"), shape: n("shape"), emptyColor: s("emptyColor"), emptyBackground: s("emptyBackground"),
                  emptyFont: s("emptyFont"), emptyFontSize: n("emptyFontSize"), emptyIconSize: n("emptyIconSize"), zoomSize: n("zoomSize"),
                  zoomTrackColor: s("zoomTrackColor"), zoomWindowColor: s("zoomWindowColor"), zoomHandleColor: s("zoomHandleColor"),
                  zoomBandColor: s("zoomBandColor"), centerColor: s("centerColor"), inlineSize: n("inlineSize"), minInlineSize: n("minInlineSize"))
    }
    public func merging(_ o: Self) -> Self { .init(cssValues: css.merging(o.css) { _, new in new }) }
    /// Full custom-property names for one element (`--md-line-chart-background`, …).
    func hooks(prefix: String) -> [String: String] { Dictionary(uniqueKeysWithValues: css.map { ("--\(prefix)-\($0.key)", $0.value) }) }
}

/// The methods of a chart element (bind with `.awcChartController(_:)`): `replay()`, `setZoom(startIndex:endIndex:)`,
/// `resetZoom()`, `drill(index:direction:)`, `refreshTheme()`, `resize()` and `toDataURL()` (the canvas as a PNG data URL:
/// the plot geometry without the text overlay, at the display scale — the source's canvas holds the same layer).
/// `getInstance()` has no native counterpart (it returns the Web engine object).
@MainActor @Observable public final class AWCChartController {
    @ObservationIgnored weak var state: AWCChartState?
    @ObservationIgnored var scale: CGFloat = 2
    nonisolated public init() {}
    public var isConnected: Bool { state != nil }
    public func replay() { guard let s = state else { return }; s.perform { s.activePlot?.replay(); s.pie?.replay() } }
    public func setZoom(startIndex: Double, endIndex: Double) { guard let s = state else { return }; s.perform { s.activePlot?.setZoom(startIndex, endIndex) } }
    public func resetZoom() { guard let s = state else { return }; s.perform { s.activePlot?.resetZoom() } }
    public func drill(index: Int, direction: String = "down") { guard let s = state else { return }; s.perform { s.drill(index, direction: direction == "up" ? "up" : "down") } }
    /// Theme tokens and hooks are read on every render; the call re-renders like the source's re-read of computed styles.
    public func refreshTheme() { state?.perform {} }
    /// The plot follows the view's size; the call re-renders like the source's ResizeObserver path.
    public func resize() { state?.perform {} }
    public func toDataURL() -> String {
        guard let s = state, let fr = s.frame(s.now()) else { return "data:," }
        let w = fr.scene.width, h = fr.scene.height
        guard w >= 1, h >= 1 else { return "data:," }
        let view = Canvas { ctx, _ in var c = ctx; c.opacity = fr.alpha; awcChartDrawScene(&c, fr.scene) }.frame(width: CGFloat(w), height: CGFloat(h))
        let r = ImageRenderer(content: view); r.scale = scale
        guard let cg = r.cgImage else { return "data:," }
        #if canImport(AppKit)
        guard let png = NSBitmapImageRep(cgImage: cg).representation(using: .png, properties: [:]) else { return "data:," }
        #else
        guard let png = UIImage(cgImage: cg).pngData() else { return "data:," }
        #endif
        return "data:image/png;base64," + png.base64EncodedString()
    }
}


// MARK: - Environment

private struct AWCChartAppearanceKey: EnvironmentKey { static let defaultValue = AWCChartAppearance() }
private struct AWCChartControllerKey: EnvironmentKey { static let defaultValue: AWCChartController? = nil }
public extension EnvironmentValues {
    var awcChartAppearance: AWCChartAppearance { get { self[AWCChartAppearanceKey.self] } set { self[AWCChartAppearanceKey.self] = newValue } }
    var awcChartController: AWCChartController? { get { self[AWCChartControllerKey.self] } set { self[AWCChartControllerKey.self] = newValue } }
}
/// Merges an appearance into the inherited one (nearer values win), like an inherited custom property.
struct AWCHookAppearanceModifier<V: Equatable>: ViewModifier {
    let keyPath: WritableKeyPath<EnvironmentValues, V>
    let merge: (V) -> V
    @Environment(\.self) private var env
    func body(content: Content) -> some View { content.environment(keyPath, merge(env[keyPath: keyPath])) }
}
public extension View {
    /// Applies chart hook values to descendant charts (inherited like the custom properties; nearer values win).
    func awcChartAppearance(_ value: AWCChartAppearance) -> some View { modifier(AWCHookAppearanceModifier(keyPath: \.awcChartAppearance) { $0.merging(value) }) }
    /// Binds the methods of the chart element below (the nearest chart).
    func awcChartController(_ controller: AWCChartController) -> some View { environment(\.awcChartController, controller) }
}
