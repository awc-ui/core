import SwiftUI

/// A wrapper part's CSS box as a typed `::part()` target (gate-7 R6-17): `background-color`, `border` (width and colour),
/// `border-radius` and the `padding` shorthand. Border and padding take layout space around the wrapper's content
/// (the source's boxes are content-box), so everything inside and after the wrapper shifts as in Chrome; the padding
/// edges are physical (left stays left in right-to-left layouts). Colours `#RRGGBB(AA)`, lengths in points.
/// Used by md-tab `content`, md-navigation-tab `container` / `icon-container`, md-breadcrumbs `overflow` and
/// md-toolbar `fab-container`.
public struct AWCPartBox: Equatable, Sendable {
    public let background: String?, borderWidth: Double?, borderColor: String?, cornerRadius: Double?, padding: [Double]?
    public init(background: String? = nil, borderWidth: Double? = nil, borderColor: String? = nil, cornerRadius: Double? = nil, padding: [Double]? = nil) {
        func c(_ v: String?) -> String? { v.flatMap { $0.isEmpty ? nil : $0 } }
        func len(_ v: Double?) -> Double? { v.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil } }
        self.background = c(background); self.borderWidth = len(borderWidth); self.borderColor = c(borderColor); self.cornerRadius = len(cornerRadius)
        self.padding = padding.flatMap { p in (1...4).contains(p.count) && p.allSatisfy { $0.isFinite && $0 >= 0 } ? p : nil }
    }
    /// Laboratory value: an object `{ background, borderWidth, borderColor, cornerRadius, padding }`; `padding` is one number, a
    /// list of one to four numbers (the CSS shorthand) or `{ top, right, bottom, left }`.
    public init?(value: AWCValue?) {
        guard case .object(let o)? = value else { return nil }
        var pad: [Double]?
        switch o["padding"] {
        case .number(let n)?: pad = [n]
        case .array(let a)?: pad = a.compactMap(\.number)
        case .object(let e)?: pad = ["top", "right", "bottom", "left"].map { e[$0]?.number ?? 0 }
        default: pad = nil
        }
        self.init(background: o["background"]?.string, borderWidth: o["borderWidth"]?.number, borderColor: o["borderColor"]?.string, cornerRadius: o["cornerRadius"]?.number, padding: pad)
    }
    public func merging(_ o: AWCPartBox?) -> AWCPartBox {
        guard let o else { return self }
        return .init(background: o.background ?? background, borderWidth: o.borderWidth ?? borderWidth, borderColor: o.borderColor ?? borderColor,
                     cornerRadius: o.cornerRadius ?? cornerRadius, padding: o.padding ?? padding)
    }
    static func merge(_ a: AWCPartBox?, _ b: AWCPartBox?) -> AWCPartBox? { a.map { $0.merging(b) } ?? b }
    /// The padding shorthand → physical (top, right, bottom, left).
    var paddingEdges: (top: Double, right: Double, bottom: Double, left: Double) {
        guard let p = padding else { return (0, 0, 0, 0) }
        switch p.count { case 1: return (p[0], p[0], p[0], p[0]); case 2: return (p[0], p[1], p[0], p[1]); case 3: return (p[0], p[1], p[2], p[1]); default: return (p[0], p[1], p[2], p[3]) }
    }
    var border: Double { borderWidth ?? 0 }
    /// Border + padding per physical edge: the distance from the border box to the content box.
    var insets: (top: Double, right: Double, bottom: Double, left: Double) { let p = paddingEdges, b = border; return (p.top + b, p.right + b, p.bottom + b, p.left + b) }
    var horizontal: Double { insets.left + insets.right }
    var vertical: Double { insets.top + insets.bottom }
    var paints: Bool { background != nil || border > 0 }
    /// Inspection metrics of the box (Laboratory schema: four-edge padding and border).
    func metrics(ink: Color) -> [String: AWCValue] {
        let p = paddingEdges
        func rgba(_ c: Color) -> AWCValue { let r = c.resolve(in: EnvironmentValues()); return .array([.number(Double(r.red)), .number(Double(r.green)), .number(Double(r.blue)), .number(Double(r.opacity))]) }
        return ["background": rgba(background.map { Color(awcHex: $0) } ?? .clear), "borderWidth": .number(border), "border": .array(Array(repeating: .number(border), count: 4)),
                "borderColor": rgba(border > 0 ? borderColor.map { Color(awcHex: $0) } ?? ink : .clear), "radius": .number(cornerRadius ?? 0),
                "padding": .array([.number(p.top), .number(p.right), .number(p.bottom), .number(p.left)])]
    }
}
extension Optional where Wrapped == AWCPartBox {
    var insets: (top: Double, right: Double, bottom: Double, left: Double) { self?.insets ?? (0, 0, 0, 0) }
    var border: Double { self?.border ?? 0 }
}

/// The paint of a part box in the border box it is given: the background under the border, both following the radius
/// (CSS: the outer radius at the border edge, the inner one smaller by the border width).
struct AWCPartBoxPaint: View {
    let box: AWCPartBox
    /// The border colour when the part sets none (CSS `currentColor`).
    var ink: Color = .primary
    var body: some View {
        GeometryReader { g in
            let r = min(box.cornerRadius ?? 0, Double(min(g.size.width, g.size.height)) / 2), shape = RoundedRectangle(cornerRadius: CGFloat(r), style: .circular)
            ZStack {
                if let c = box.background { shape.fill(Color(awcHex: c)) }
                if box.border > 0 { shape.strokeBorder(box.borderColor.map { Color(awcHex: $0) } ?? ink, lineWidth: CGFloat(box.border)) }
            }
        }
        .allowsHitTesting(false).accessibilityHidden(true)
    }
}
private struct AWCPartBoxModifier: ViewModifier {
    let box: AWCPartBox?, ink: Color
    @Environment(\.layoutDirection) private var direction
    func body(content: Content) -> some View {
        if let box, box.paints || box.horizontal > 0 || box.vertical > 0 {
            let i = box.insets, rtl = direction == .rightToLeft
            content
                .padding(EdgeInsets(top: CGFloat(i.top), leading: CGFloat(rtl ? i.right : i.left), bottom: CGFloat(i.bottom), trailing: CGFloat(rtl ? i.left : i.right)))
                .background { if box.paints { AWCPartBoxPaint(box: box, ink: ink) } }
        } else { content }
    }
}
extension View {
    /// Lays the view out inside a part box (border + padding around it, physical edges) and paints the box behind it.
    func awcPartBox(_ box: AWCPartBox?, ink: Color = .primary) -> some View { modifier(AWCPartBoxModifier(box: box, ink: ink)) }
}
