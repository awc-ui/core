import SwiftUI

/// The exported `::part()` targets of md-line-chart / md-area-chart / md-bar-chart (header, canvas, empty, loading, footer and
/// the zoom strip: zoom, zoom-slider, zoom-pan, zoom-band and md-slider's zoom-track / zoom-window / zoom-handle),
/// md-pie-chart (header, canvas, center, empty, loading, footer) and md-sparkline (canvas).
public enum AWCChartPart: String, CaseIterable, Sendable, Hashable {
    case header, canvas, empty, loading, footer, center
    case zoom, zoomSlider = "zoom-slider", zoomPan = "zoom-pan", zoomBand = "zoom-band"
    case zoomTrack = "zoom-track", zoomWindow = "zoom-window", zoomHandle = "zoom-handle"
    /// The parts a chart kind exports (its CEM `cssParts`).
    public static func exported(by tag: String) -> [AWCChartPart] {
        switch tag {
        case "md-pie-chart": return [.header, .canvas, .center, .empty, .loading, .footer]
        case "md-sparkline": return [.canvas]
        default: return [.zoom, .zoomSlider, .zoomPan, .header, .canvas, .empty, .loading, .zoomBand, .footer, .zoomTrack, .zoomWindow, .zoomHandle]
        }
    }
}

/// `::part()` declarations of a chart part: the shared sparse vocabulary (colour, background, opacity, border-radius,
/// padding, font size / weight / letter-spacing). Part rules win over the chart hooks for the part's own box.
public typealias AWCChartPartAppearance = AWCPartStyle

private struct AWCChartPartsKey: EnvironmentKey { static let defaultValue: [AWCChartPart: AWCPartStyle] = [:] }
private struct AWCChartPartTargetsKey: EnvironmentKey { static let defaultValue: [String: [AWCChartPart: AWCPartStyle]] = [:] }
extension EnvironmentValues {
    var awcChartParts: [AWCChartPart: AWCPartStyle] { get { self[AWCChartPartsKey.self] } set { self[AWCChartPartsKey.self] = newValue } }
    var awcChartPartTargets: [String: [AWCChartPart: AWCPartStyle]] { get { self[AWCChartPartTargetsKey.self] } set { self[AWCChartPartTargetsKey.self] = newValue } }
    /// A part's effective declarations for the chart with node id `id` (targeted rules over the shared ones).
    func awcChartPart(_ part: AWCChartPart, id: String) -> AWCPartStyle {
        let base = awcChartParts[part] ?? .init()
        return awcChartPartTargets[id]?[part].map { base.merging($0) } ?? base
    }
}
private struct AWCChartPartModifier: ViewModifier {
    let styles: [AWCChartPart: AWCPartStyle], id: String?
    @Environment(\.awcChartParts) private var inherited
    @Environment(\.awcChartPartTargets) private var targets
    func body(content: Content) -> some View {
        if let id {
            var t = targets; var own = t[id] ?? [:]
            for (p, s) in styles { own[p] = (own[p] ?? .init()).merging(s) }
            t[id] = own; return AnyView(content.environment(\.awcChartPartTargets, t))
        }
        var all = inherited; for (p, s) in styles { all[p] = (all[p] ?? .init()).merging(s) }
        return AnyView(content.environment(\.awcChartParts, all))
    }
}
public extension View {
    /// `::part()` styling for the charts in this view (`for`: only the chart with that node id).
    func awcChartPartAppearance(_ part: AWCChartPart, _ style: AWCChartPartAppearance, for id: String? = nil) -> some View { modifier(AWCChartPartModifier(styles: [part: style], id: id)) }
    /// Several parts at once.
    func awcChartPartAppearance(_ styles: [AWCChartPart: AWCChartPartAppearance], for id: String? = nil) -> some View { modifier(AWCChartPartModifier(styles: styles, id: id)) }
}

/// A part's inherited text styles (colour, font size / weight) for slotted content and the part's own text.
struct AWCChartPartText: ViewModifier {
    let style: AWCPartStyle
    func body(content: Content) -> some View {
        let colored = Group { if let c = style.color { content.foregroundStyle(Color(awcChartCSS: c)) } else { content } }
        if let size = style.fontSize { colored.font(AWCNativeFonts.label(size: size, weight: style.fontWeight ?? 400)) } else { colored }
    }
}
