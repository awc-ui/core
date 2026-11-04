import SwiftUI

// Dedicated SwiftUI renderer for md-line-chart, md-area-chart, md-bar-chart, md-pie-chart and
// md-sparkline. The geometry is the ported engine's RenderScene drawn on a Canvas; overlay text,
// glyphs, end labels and legend chips follow overlay.ts; the host box follows each component's CSS.

private struct AWCChartFormattersKey: EnvironmentKey { static let defaultValue: [String: AWCChartFormatters] = [:] }
extension EnvironmentValues {
    /// Function-valued chart properties (valueFormatter, axis formatters) keyed by node id ("" = every chart).
    var awcChartFormatters: [String: AWCChartFormatters] {
        get { self[AWCChartFormattersKey.self] }
        set { self[AWCChartFormattersKey.self] = newValue }
    }
}
public extension View {
    /// Supplies the Web component's function-valued properties to a native chart (`nodeID` nil = all charts below).
    func awcChartFormatters(_ formatters: AWCChartFormatters, nodeID: String? = nil) -> some View {
        transformEnvironment(\.awcChartFormatters) { $0[nodeID ?? ""] = formatters }
    }
}

enum AWCChartKind: String {
    case line = "md-line-chart", area = "md-area-chart", bar = "md-bar-chart", pie = "md-pie-chart", sparkline = "md-sparkline"
    var prefix: String { rawValue }
}

/// CSS `<length>` in px (px, plain numbers); nil for anything else.
func awcChartCSSPixels(_ raw: String?) -> Double? {
    guard var s = raw?.trimmingCharacters(in: .whitespaces), !s.isEmpty else { return nil }
    if s.hasSuffix("px") { s.removeLast(2) }
    let n = awcJSParseFloat(s)
    return n.isFinite ? n : nil
}

/// The host box per component CSS (padding, corner, minimum/aspect sizing) at a density.
struct AWCChartHostMetrics {
    var padding: Double, shape: Double, minHeight: Double, aspect: Double
    var background: String, emptyColor: String, emptyBackground: String
    static func of(_ kind: AWCChartKind, tokens: [String: String], density d: Double) -> AWCChartHostMetrics {
        let p = kind.prefix
        func tok(_ k: String) -> String? { let v = (tokens["--\(p)-\(k)"] ?? "").trimmingCharacters(in: .whitespaces); return v.isEmpty ? nil : v }
        let bg = tok("background") ?? awcChartToken(tokens, "--md-sys-color-surface-container-low", "#F7F2FA")
        let pad = awcChartCSSPixels(tok("padding")) ?? Swift.max(8, 16 + d * 2)
        let shape = awcChartCSSPixels(tok("shape")) ?? Swift.max(8, 16 + d * 2)
        let minH = awcChartCSSPixels(tok("min-block-size")) ?? (kind == .pie ? Swift.max(140, 200 + d * 12) : Swift.max(120, 160 + d * 8))
        let aspect: Double = {
            if let a = tok("aspect-ratio") { let parts = a.split(separator: "/").map { awcJSParseFloat(String($0)) }; if parts.count == 2, parts[1] > 0 { return parts[0] / parts[1] }; if let f = parts.first, f > 0 { return f } }
            return kind == .pie ? 1 : 16.0 / 9.0
        }()
        return AWCChartHostMetrics(padding: kind == .sparkline ? 0 : pad, shape: kind == .sparkline ? 0 : shape, minHeight: kind == .sparkline ? 0 : minH, aspect: aspect, background: kind == .sparkline ? "transparent" : bg,
                                   emptyColor: tok("empty-color") ?? awcChartToken(tokens, "--md-sys-color-on-surface-variant", "#49454F"), emptyBackground: tok("empty-background") ?? bg)
    }
}

// MARK: Overlay text (overlay.ts syncOverlay / renderGlyphs / renderEndLabels)

private func awcChartFont(_ size: Double, _ weight: Double) -> Font {
    _ = AWCNativeFonts.labelFamily(regular: true)
    return .custom(awcChartFontName(weight: weight), fixedSize: size)
}

/// Draws one absolutely positioned span: `left/top` + `translate(ax, ay)` (+ rotate about the box centre).
func awcChartDrawSpan(_ ctx: inout GraphicsContext, text: String, x: Double, y: Double, ax: Double, ay: Double, size: Double, weight: Double, color: String, rotate: Double? = nil, lineHeight: Double? = nil) {
    let resolved = ctx.resolve(Text(text).font(awcChartFont(size, weight)).foregroundColor(Color(awcChartCSS: color)))
    let natural = resolved.measure(in: CGSize(width: 100_000, height: 100_000))
    let w = AWCChartTextMetrics.width(text, size: size, weight: weight)
    let h = lineHeight ?? AWCChartTextMetrics.normalLineHeight(size: size, weight: weight)
    let cx = x + w / 2 + ax * w, cy = y + h / 2 + ay * h
    var c = ctx
    c.translateBy(x: cx, y: cy)
    if let r = rotate, r != 0 { c.rotate(by: .degrees(r)) }
    c.draw(resolved, in: CGRect(x: -natural.width / 2, y: -natural.height / 2, width: natural.width, height: natural.height))
}

private func awcAlignX(_ a: String) -> Double { a == "center" ? -0.5 : a == "end" ? -1 : 0 }
private func awcAlignY(_ b: String) -> Double { b == "middle" ? -0.5 : b == "bottom" ? -1 : 0 }
private func awcPercent(_ s: String) -> Double { s.hasSuffix("%") ? awcJSParseFloat(String(s.dropLast())) / 100 : 0 }

/// `pieLabelAlpha`: the pie's slice labels (`pl-` keys) are held back during the entrance / a drill (paceLabels).
func awcChartDrawOverlay(_ ctx: inout GraphicsContext, _ scene: AWCChartScene, endLabelOpacity: Double = 1, pieLabelAlpha: Double = 1) {
    for t in scene.texts {
        if t.key.hasPrefix("pl-") && pieLabelAlpha < 1 {
            var c = ctx; c.opacity = pieLabelAlpha
            awcChartDrawSpan(&c, text: t.text, x: t.x, y: t.y, ax: awcAlignX(t.align), ay: awcAlignY(t.baseline), size: t.fontSize, weight: t.fontWeight ?? 400, color: t.color, rotate: t.rotate)
            continue
        }
        awcChartDrawSpan(&ctx, text: t.text, x: t.x, y: t.y, ax: awcAlignX(t.align), ay: awcAlignY(t.baseline), size: t.fontSize, weight: t.fontWeight ?? 400, color: t.color, rotate: t.rotate)
    }
    for g in scene.glyphs ?? [] {
        if let l = g.label {
            awcChartDrawSpan(&ctx, text: g.text, x: g.x + l.dx, y: g.y + l.dy, ax: awcPercent(l.anchorX), ay: awcPercent(l.anchorY), size: g.size, weight: l.weight, color: l.color, lineHeight: g.size)
        } else {
            awcChartDrawSpan(&ctx, text: g.text, x: g.x, y: g.y, ax: -0.5, ay: -0.5, size: g.size, weight: 400, color: "#000000", lineHeight: g.size)
        }
    }
    for e in scene.endLabels ?? [] where e.visible {
        var c = ctx; c.opacity = endLabelOpacity
        let end = e.side == "end"
        awcChartDrawSpan(&c, text: e.text, x: end ? e.x - 12 : e.x + 12, y: e.y, ax: end ? -1 : 0, ay: -0.5, size: e.size, weight: 500, color: e.color)
    }
}

// MARK: Legend chips (overlay.ts)

struct AWCChartLegendChipLayout { var item: AWCChartLegendItem; var frame: CGRect }

/// The legend nav's chip frames in plot-host coordinates (flex rows / side column, LTR or RTL).
func awcChartLegendLayout(_ scene: AWCChartScene, rtl: Bool) -> (chips: [AWCChartLegendChipLayout], fontSize: Double) {
    let items = scene.legend
    let fontSize = scene.texts.first?.fontSize ?? 11
    guard items.count > 1 else { return ([], fontSize) }
    let pos = scene.legendPosition ?? "top-end"
    let isSide = pos == "left" || pos == "right"
    let atBottom = pos.hasPrefix("bottom")
    let logicalStart = pos.hasSuffix("start") || pos.hasSuffix("end") ? (pos.hasSuffix("start") != rtl) : pos == "left"
    let chipH = Swift.max(10, AWCChartTextMetrics.normalLineHeight(size: fontSize)) + 4
    let widths = items.map { 4 + 10 + 6 + AWCChartTextMetrics.width($0.label, size: fontSize) + 4 }
    var out: [AWCChartLegendChipLayout] = []
    if isSide {
        let maxW = AWC_LEGEND_SIDE_MAX_FRACTION * scene.width
        let navW = Swift.min(maxW, (widths.max() ?? 0) + 12)
        let content = Double(items.count) * chipH + Double(items.count - 1) * 6
        let navH = Swift.min(scene.height * 0.92, content + 12)
        let navX = pos == "left" ? 12 : scene.width - 12 - navW
        let navY = scene.height / 2 - navH / 2
        var y = navY + 6
        for (i, item) in items.enumerated() {
            let w = Swift.min(widths[i], navW - 12)
            let x = rtl ? navX + navW - 6 - w : navX + 6
            out.append(AWCChartLegendChipLayout(item: item, frame: CGRect(x: x, y: y, width: w, height: chipH)))
            y += chipH + 6
        }
        return (out, fontSize)
    }
    let corner = pos.contains("-")
    let avail = corner ? scene.width * 0.88 : scene.width - 24
    var rows: [[Int]] = [[]], rowW: [Double] = [0]
    for (i, w) in widths.enumerated() {
        let cw = Swift.min(w, avail)
        if rowW[rowW.count - 1] > 0 && rowW[rowW.count - 1] + 12 + cw > avail + 0.001 { rows.append([i]); rowW.append(cw) }
        else { rowW[rowW.count - 1] += (rowW[rowW.count - 1] > 0 ? 12 : 0) + cw; rows[rows.count - 1].append(i) }
    }
    let navW = corner ? Swift.min(avail, rowW.max() ?? 0) : scene.width - 24
    let navH = Double(rows.count) * chipH + Double(rows.count - 1) * 4
    let navX: Double = corner ? (logicalStart ? 12 : scene.width - 12 - navW) : 12
    let navY = atBottom ? scene.height - 2 - navH : 2
    for (r, row) in rows.enumerated() {
        let y = navY + Double(r) * (chipH + 4)
        // justify-content: start / end / center along the row's inline direction (RTL flips the row).
        let justify: Double = corner ? (logicalStart ? 0 : 1) : 0.5
        let free = navW - rowW[r]
        var x = rtl ? navX + navW - free * (1 - justify) : navX + free * justify
        for i in row {
            let w = Swift.min(widths[i], avail)
            if rtl { x -= w; out.append(AWCChartLegendChipLayout(item: items[i], frame: CGRect(x: x, y: y, width: w, height: chipH))); x -= 12 }
            else { out.append(AWCChartLegendChipLayout(item: items[i], frame: CGRect(x: x, y: y, width: w, height: chipH))); x += w + 12 }
        }
    }
    return (out, fontSize)
}

struct AWCChartLegendChip: View {
    let item: AWCChartLegendItem
    let fontSize: Double
    let rtl: Bool
    let tokens: [String: String]
    let action: () -> Void
    @State private var focusHandle = AWCButtonFocusHandle()
    var body: some View {
        let ink = item.hidden ? awcChartToken(tokens, "--md-sys-color-outline", "#79747E") : awcChartToken(tokens, "--md-sys-color-on-surface-variant", "#49454F")
        Button(action: action) {
            HStack(spacing: 6) {
                RoundedRectangle(cornerRadius: 3).fill(Color(awcChartCSS: item.color)).frame(width: 10, height: 10).opacity(item.hidden ? 0.4 : 1)
                Text(item.label).font(awcChartFont(fontSize, 400)).foregroundColor(Color(awcChartCSS: ink)).strikethrough(item.hidden).lineLimit(1).truncationMode(.tail)
            }
            .padding(.horizontal, 4).padding(.vertical, 2)
            .environment(\.layoutDirection, rtl ? .rightToLeft : .leftToRight)
        }
        .buttonStyle(.plain)
        .help(item.label)
        .modifier(AWCIconButtonFocusModifier(id: "legend-\(item.seriesIndex)", label: item.label, enabled: true,
            properties: ["toggle": .bool(true), "selected": .bool(!item.hidden)], group: nil, handle: focusHandle, focusChanged: nil, activate: action))
    }
}

/// `inline-size: 100%` + `aspect-ratio` + `min-block-size` (+ an explicit block size when given).
struct AWCChartAspectSizing: ViewModifier {
    let aspect: Double, minHeight: Double, explicit: Bool
    func body(content: Content) -> some View {
        if explicit { content.frame(maxWidth: .infinity) }
        else { content.frame(maxWidth: .infinity).modifier(AWCChartAspectFrame(aspect: aspect, minHeight: minHeight)) }
    }
}
private struct AWCChartAspectFrame: ViewModifier {
    let aspect: Double, minHeight: Double
    @State private var width: Double = 0
    func body(content: Content) -> some View {
        content
            .frame(height: Swift.max(minHeight, width / Swift.max(0.01, aspect)))
            .onGeometryChange(for: Double.self) { $0.size.width } action: { width = $0 }
    }
}

func awcChartPieKeys(_ props: AWCChartProps) -> [String] {
    var flat: [AWCValue] = []
    func walk(_ items: [AWCValue]) { for d in items { flat.append(d); walk(d["children"].array) } }
    walk(props.obj("data")?.array ?? [])
    var seen: [String: Int] = [:]
    return flat.enumerated().map { i, d in
        let base = d["id"] != .null ? "id:\(d["id"].string)" : d["label"] != .null ? "label:\(d["label"].string)" : "pos:\(i)"
        let n = seen[base] ?? 0; seen[base] = n + 1
        return n == 0 ? base : "\(base)#\(n)"
    }
}

/// a11y.ts `buildChartSummary`.
func awcChartBuildSummary(title: String, chartType: String, seriesCount: Int, xMin: AWCChartAxisValue?, xMax: AWCChartAxisValue?, locale: String) -> String {
    let verb = ["pie": "Pie chart", "bar": "Bar chart", "area": "Area chart", "sparkline": "Sparkline"][chartType] ?? "Line chart"
    var parts: [String] = []
    if !title.isEmpty { parts.append(title) }
    parts.append(verb)
    if chartType == "pie" {
        if seriesCount > 0 { parts.append((seriesCount == 1 ? "with %count% slice" : "with %count% slices").replacingOccurrences(of: "%count%", with: String(seriesCount))) }
    } else if seriesCount > 1 { parts.append("with %count% series".replacingOccurrences(of: "%count%", with: String(seriesCount))) }
    if let a = xMin, let b = xMax, chartType != "pie" {
        parts.append("from %min% to %max%".replacingOccurrences(of: "%min%", with: awcChartDefaultValueFormatter(a, locale)).replacingOccurrences(of: "%max%", with: awcChartDefaultValueFormatter(b, locale)))
    }
    return parts.joined(separator: ", ") + "."
}

/// md-sparkline's aria-label.
func awcChartSparkSummary(_ props: AWCChartProps, formatters: AWCChartFormatters) -> String {
    let data = (props.obj("data")?.array ?? []).compactMap { v -> Double? in if case .number(let n) = v { return n }; return nil }
    func fmt(_ v: Double?) -> String { if let f = formatters.valueFormatter { return f(v) }; return v.map { AWCChartIntl.number($0, "") } ?? "—" }
    let refLabels = (props.obj("referenceAreas")?.array ?? []).compactMap { $0["label"] == .null ? nil : $0["label"].string }.filter { !$0.isEmpty }
    let refNote = refLabels.isEmpty ? "" : " Highlighted: \(refLabels.joined(separator: ", "))."
    guard let last = data.last else { return "Sparkline, no data.\(refNote)" }
    return "Sparkline, latest \(fmt(last)), range \(fmt(data.min())) to \(fmt(data.max())).\(refNote)"
}
