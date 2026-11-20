import SwiftUI

/// The inline `style` subset authors use on plain slotted HTML (the page's own CSS reaching light-DOM content): padding,
/// text-align, a box filling its positioned ancestor (`position: absolute; inset: 0`), flex row centring + gap, background,
/// colour, the `font` shorthand / font-size / font-weight / font-family (Material Symbols).
struct AWCAuthoredStyle {
    var padding: [Double] = [0, 0, 0, 0]   // top, right, bottom, left (physical)
    var center = false, fill = false, flex = false, alignCenter = false, justifyCenter = false, symbols = false
    var background: String?, color: String?, fontSize: Double?, fontWeight: Double?, gap: Double?
    static func px(_ v: String) -> Double? { let t = v.trimmingCharacters(in: .whitespaces); return Double(t.hasSuffix("px") ? String(t.dropLast(2)) : t) }
    init(_ raw: String) {
        var absolute = false, inset = false
        for decl in raw.split(separator: ";") {
            let kv = decl.split(separator: ":", maxSplits: 1).map { $0.trimmingCharacters(in: .whitespaces) }
            guard kv.count == 2 else { continue }
            let v = kv[1]
            switch kv[0].lowercased() {
            case "padding":
                let n = v.split(separator: " ").compactMap { Self.px(String($0)) }
                switch n.count { case 1: padding = [n[0], n[0], n[0], n[0]]; case 2: padding = [n[0], n[1], n[0], n[1]]; case 3: padding = [n[0], n[1], n[2], n[1]]; case 4: padding = n; default: break }
            case "text-align": center = v == "center"
            case "position": absolute = v == "absolute" || v == "fixed"
            case "inset": inset = v.split(separator: " ").allSatisfy { $0 == "0" || $0 == "0px" }
            case "display": flex = v == "flex" || v == "inline-flex"
            case "align-items": alignCenter = v == "center"
            case "justify-content": justifyCenter = v == "center"
            case "background", "background-color": background = v
            case "color": color = v
            case "font-size": fontSize = Self.px(v)
            case "font-weight": fontWeight = Double(v) ?? (v == "bold" ? 700 : v == "normal" ? 400 : nil)
            case "gap": gap = Self.px(v)
            case "font-family": symbols = v.contains("Material Symbols")
            case "font":
                // font: [style] [weight] size[/line-height] family…
                for t in v.split(separator: " ").map(String.init) {
                    if fontSize == nil, let w = Double(t), (1...1000).contains(w) { fontWeight = w }
                    else if t == "bold" { fontWeight = 700 }
                    else if fontSize == nil, let n = Self.px(String(t.split(separator: "/").first ?? "")), t.contains("px") { fontSize = n }
                }
                if v.contains("Material Symbols") { symbols = true }
            default: break
            }
        }
        fill = absolute && inset
    }
}

/// Plain authored HTML elements (div, span, p, strong, em, b, i, small, br) placed in a component slot: rendered with the
/// inline style subset above; text inherits the surrounding font and colour (SwiftUI environment), as light DOM inherits
/// from its host. Material Symbols spans render the named symbol.
struct AWCAuthoredElement: View {
    /// The plain HTML tags rendered here (AWCNativeView dispatch); their text inherits the slot's colour.
    static let tags: Set<String> = ["div", "span", "p", "strong", "em", "b", "i", "small", "br"]
    let node: AWCNode
    let onEvent: (AWCEvent) -> Void
    /// Text and nested authored elements inherit font and colour; other children are components (AWCNativeView).
    @ViewBuilder func child(_ c: AWCNode) -> some View {
        if c.tag == "#text" { Text(c.properties["text"]?.string ?? "") }
        else if Self.tags.contains(c.tag) { AWCAuthoredElement(node: c, onEvent: onEvent).modifier(AWCStackingLift()) }
        else { AWCNativeView(node: c, onEvent: onEvent) }
    }
    @Environment(\.layoutDirection) private var direction
    var body: some View {
        let st = AWCAuthoredStyle(node.properties["style"]?.string ?? "")
        let cls = node.properties["class"]?.string ?? ""
        if node.tag == "br" { Color.clear.frame(width: 0, height: 0) }
        else if st.symbols || cls.contains("material-symbols") {
            AWCMaterialSymbol(node.authoredTextContent.trimmingCharacters(in: .whitespacesAndNewlines), size: st.fontSize ?? 24)
                .modifier(AWCAuthoredColor(color: st.color))
        } else {
            let inline = node.children.allSatisfy { ["#text", "#slot-text", "span", "strong", "em", "b", "i", "small", "br"].contains($0.tag) }
            let centred = st.center || (st.flex && st.justifyCenter)
            Group {
                if st.flex || (inline && node.children.count > 1) {
                    HStack(alignment: st.alignCenter || !st.flex ? .center : .top, spacing: st.gap ?? 0) { ForEach(node.children) { child($0) } }
                } else {
                    VStack(alignment: st.center ? .center : .leading, spacing: 0) { ForEach(node.children) { child($0) } }
                }
            }
            .multilineTextAlignment(st.center ? .center : .leading)
            .modifier(AWCAuthoredFont(size: st.fontSize, weight: st.fontWeight ?? (["strong", "b"].contains(node.tag) ? 700 : nil), italic: ["em", "i"].contains(node.tag)))
            .modifier(AWCAuthoredColor(color: st.color))
            .frame(maxWidth: centred || st.fill ? .infinity : nil, maxHeight: st.fill ? .infinity : nil,
                   alignment: Alignment(horizontal: centred ? .center : .leading, vertical: st.flex && st.alignCenter ? .center : .top))
            .padding(EdgeInsets(top: st.padding[0], leading: direction == .rightToLeft ? st.padding[1] : st.padding[3],
                                bottom: st.padding[2], trailing: direction == .rightToLeft ? st.padding[3] : st.padding[1]))
            .background { if let bg = st.background, let c = AWCTableColor.parse(bg) { Rectangle().fill(AWCTableColor.color(c)) } }
        }
    }
}
private struct AWCAuthoredColor: ViewModifier {
    let color: String?
    func body(content: Content) -> some View {
        if let c = color.flatMap({ AWCTableColor.parse($0) }) { content.foregroundStyle(AWCTableColor.color(c)) } else { content }
    }
}
private struct AWCAuthoredFont: ViewModifier {
    let size: Double?, weight: Double?, italic: Bool
    func body(content: Content) -> some View {
        let w = weight.map { AWCAuthoredFont.swiftWeight($0) }
        if let size { content.font(AWCNativeFonts.label(size: size, weight: weight ?? 400)).italic(italic) }
        else if let w { content.fontWeight(w).italic(italic) }
        else { content.italic(italic) }
    }
    static func swiftWeight(_ w: Double) -> Font.Weight {
        switch w { case ..<150: return .ultraLight; case ..<250: return .thin; case ..<350: return .light; case ..<450: return .regular
        case ..<550: return .medium; case ..<650: return .semibold; case ..<750: return .bold; case ..<850: return .heavy; default: return .black }
    }
}

/// AWCNativeView's default text colour (on-surface) for components; authored HTML inherits its slot's instead.
struct AWCNativeForeground: ViewModifier {
    let style: Color, inherit: Bool
    func body(content: Content) -> some View { if inherit { content } else { content.foregroundStyle(style) } }
}
