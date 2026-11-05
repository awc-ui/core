import SwiftUI

// Port of engine/hover.ts: the crosshair, hover markers (with the 320 ms pop), and the tooltip card
// (rows, custom renderer, edge flipping) for a hovered or keyboard-focused data index.

/// md-chart tooltip context handed to a native tooltip renderer (MdChartTooltipContext).
public struct AWCChartTooltipSeries { public var seriesIndex: Int; public var label: String; public var color: String; public var value: Double?; public var formattedValue: String; public var focused: Bool; public var missing: Bool; public var percent: Double? = nil }
public struct AWCChartTooltipContext { public var dataIndex: Int; public var axisValue: AWCChartAxisValue?; public var axisLabel: String; public var series: [AWCChartTooltipSeries]; public var missing: [AWCChartTooltipSeries]; public var focusedSeriesIndex: Int }
/// A renderer returns nil for "no tooltip here", `.text` for plain content, or `.default` to keep the built-in card.
public enum AWCChartTooltipContent { case none, text(String), `default` }

struct AWCChartHoverRow: Equatable { var color: String?; var label: String; var value: String }

/// Everything the hover layer draws for one index (hover.ts renderHover), in plot-host coordinates.
struct AWCChartHoverModel: Equatable {
    var index: Int
    var orient: String
    var line: CGRect?
    var markers: [(symbol: String?, color: String, x: Double, y: Double, dimmed: Bool)]
    var header: String
    var rows: [AWCChartHoverRow]
    var customText: String?
    var cursor: CGPoint
    var pos: Double
    static func == (a: Self, b: Self) -> Bool { a.index == b.index && a.rows == b.rows && a.cursor == b.cursor && a.header == b.header && a.customText == b.customText && a.markers.count == b.markers.count }
}

func awcChartHoverModel(_ scene: AWCChartScene, index: Int, yFormatter: (Double) -> String, cursor: CGPoint, orient: String, focusSeries: Int,
                        trigger: String, missingFormatter: ((Double?) -> String)?, renderer: ((AWCChartTooltipContext) -> AWCChartTooltipContent)?) -> AWCChartHoverModel? {
    guard index >= 0, index < scene.xPositions.count else { return nil }
    let pos = scene.xPositions[index]
    let plot = scene.plot
    var lo = orient == "horizontal" ? plot.x : plot.y
    var hi = lo + (orient == "horizontal" ? plot.width : plot.height)
    if orient != "none" {
        for hp in scene.hoverPoints { guard let pt = hp.byIndex[index] else { continue }; let v = orient == "horizontal" ? pt.x : pt.y; lo = Swift.min(lo, v); hi = Swift.max(hi, v) }
    }
    let line: CGRect? = orient == "none" ? nil : orient == "horizontal" ? CGRect(x: lo, y: pos - 0.5, width: hi - lo, height: 1) : CGRect(x: pos - 0.5, y: lo, width: 1, height: hi - lo)
    var markers: [(symbol: String?, color: String, x: Double, y: Double, dimmed: Bool)] = []
    var rows: [AWCChartHoverRow] = []
    var present: [AWCChartTooltipSeries] = [], absent: [AWCChartTooltipSeries] = []
    let itemOnly = trigger == "item" && focusSeries >= 0
    for hp in scene.hoverPoints {
        if itemOnly && hp.seriesIndex != focusSeries { continue }
        let custom = hp.valueFormat
        func format(_ v: Double) -> String { custom.map { $0(v) } ?? yFormatter(v) }
        let focused = hp.seriesIndex == focusSeries
        if let p = hp.byIndex[index] {
            let swatch = p.color ?? hp.color
            if hp.unanchored != true && orient != "none" { markers.append((p.symbol, swatch, p.x, p.y, focusSeries >= 0 && !focused)) }
            let value = p.low != nil && p.high != nil ? "\(format(p.low!)) – \(format(p.high!))" : format(p.value)
            rows.append(AWCChartHoverRow(color: swatch, label: hp.label, value: value))
            if renderer != nil { present.append(AWCChartTooltipSeries(seriesIndex: hp.seriesIndex, label: hp.label, color: hp.color, value: p.value, formattedValue: value, focused: focused, missing: false)) }
            continue
        }
        if renderer == nil && missingFormatter == nil { continue }
        let text = missingFormatter?(nil) ?? ""
        if renderer != nil { absent.append(AWCChartTooltipSeries(seriesIndex: hp.seriesIndex, label: hp.label, color: hp.color, value: nil, formattedValue: text, focused: focused, missing: true)) }
        if !text.isEmpty { rows.append(AWCChartHoverRow(color: nil, label: hp.label, value: text)) }
    }
    let header = index < scene.xLabels.count ? scene.xLabels[index] : ""
    var custom: String? = nil
    if let renderer {
        let ctx = AWCChartTooltipContext(dataIndex: index, axisValue: index < scene.xValues.count ? scene.xValues[index] : nil, axisLabel: header, series: present, missing: absent, focusedSeriesIndex: focusSeries)
        switch renderer(ctx) {
        case .none: return AWCChartHoverModel(index: index, orient: orient, line: line, markers: markers, header: header, rows: [], customText: nil, cursor: cursor, pos: pos)
        case .text(let t): custom = t
        case .default: break
        }
    }
    return AWCChartHoverModel(index: index, orient: orient, line: line, markers: markers, header: header, rows: rows, customText: custom, cursor: cursor, pos: pos)
}

/// hover.ts `positionTooltip` (card size measured natively).
func awcChartTooltipOrigin(_ scene: AWCChartScene, size: CGSize, cursor: CGPoint, orient: String, pos: Double, rtl: Bool) -> CGPoint {
    let tw = size.width > 0 ? size.width : 120, th = size.height > 0 ? size.height : 60
    if th + 8 > scene.height {
        let fits = tw + 8 <= scene.width
        let l = fits ? Swift.max(4, Swift.min(cursor.x - tw / 2, scene.width - tw - 4)) : Swift.max(24 - tw, Swift.min(cursor.x - tw / 2, scene.width - 24))
        let plotBottom = scene.plot.y + scene.plot.height
        return CGPoint(x: l.rounded(), y: (plotBottom + 6).rounded())
    }
    var left: Double, top: Double
    if orient == "none" {
        left = cursor.x + 14
        if left + tw > scene.width - 4 { left = cursor.x - tw - 14 }
        left = Swift.max(4, Swift.min(left, scene.width - tw - 4))
        top = cursor.y + 14
        if top + th > scene.height - 4 { top = cursor.y - th - 14 }
        top = Swift.max(4, Swift.min(top, scene.height - th - 4))
    } else if orient == "horizontal" {
        top = pos + 14
        if top + th > scene.height - 4 { top = pos - th - 14 }
        top = Swift.max(4, top)
        left = rtl ? Swift.max(4, Swift.min(cursor.x - tw - 14, scene.width - tw - 4)) : Swift.max(4, Swift.min(cursor.x + 14, scene.width - tw - 4))
    } else {
        left = rtl ? pos - tw - 14 : pos + 14
        if rtl ? left < 4 : left + tw > scene.width - 4 { left = rtl ? pos + 14 : pos - tw - 14 }
        left = Swift.max(4, Swift.min(left, scene.width - tw - 4))
        top = Swift.max(4, Swift.min(cursor.y - th / 2, scene.height - th - 4))
    }
    return CGPoint(x: left, y: top)
}

/// The pop keyframes (scale 0.4 → 1.25 → 0.94 → 1 at 0/45/72/100 %) over 320 ms, iteration easing cubic-bezier(0.2, 0, 0, 1).
private let awcPopEase = awcChartCubicBezier(0.2, 0, 0, 1)
func awcChartPopScale(_ elapsedMs: Double) -> Double {
    if elapsedMs >= 320 { return 1 }
    let p = awcPopEase(Swift.max(0, elapsedMs / 320))
    let keys: [(Double, Double)] = [(0, 0.4), (0.45, 1.25), (0.72, 0.94), (1, 1)]
    for k in 1..<keys.count where p <= keys[k].0 { let a = keys[k - 1], b = keys[k]; return a.1 + (b.1 - a.1) * (p - a.0) / (b.0 - a.0) }
    return 1
}

/// The hover marker (buildHoverMarker): a 13 px ringed circle or an 11 px clipped shape with a surface outline, or an emoji glyph.
struct AWCChartHoverMarker: View {
    let symbol: String?
    let color: String
    let surface: String
    var body: some View {
        if let s = symbol, !["circle", "square", "diamond", "triangle", "triangle-down"].contains(s) {
            Text(s).font(.system(size: 22)).fixedSize()
        } else if symbol == nil || symbol == "circle" {
            Circle().fill(Color(awcChartCSS: color)).overlay(Circle().strokeBorder(Color(awcChartCSS: surface), lineWidth: 2))
                .frame(width: 13, height: 13).shadow(color: .black.opacity(0.3), radius: 1, x: 0, y: 1)
        } else {
            ZStack {
                AWCChartClipShape(symbol: symbol!).fill(Color(awcChartCSS: surface)).frame(width: 15, height: 15)
                AWCChartClipShape(symbol: symbol!).fill(Color(awcChartCSS: color)).frame(width: 11, height: 11)
            }
            .frame(width: 11, height: 11).shadow(color: .black.opacity(0.3), radius: 1, x: 0, y: 1)
        }
    }
}

/// hover.ts SHAPE_CLIP polygons (square = the plain box).
struct AWCChartClipShape: Shape {
    let symbol: String
    func path(in r: CGRect) -> Path {
        var p = Path()
        switch symbol {
        case "diamond": p.addLines([CGPoint(x: r.midX, y: r.minY), CGPoint(x: r.maxX, y: r.midY), CGPoint(x: r.midX, y: r.maxY), CGPoint(x: r.minX, y: r.midY)])
        case "triangle": p.addLines([CGPoint(x: r.midX, y: r.minY), CGPoint(x: r.maxX, y: r.maxY), CGPoint(x: r.minX, y: r.maxY)])
        case "triangle-down": p.addLines([CGPoint(x: r.minX, y: r.minY), CGPoint(x: r.maxX, y: r.minY), CGPoint(x: r.midX, y: r.maxY)])
        default: p.addRect(r)
        }
        p.closeSubpath()
        return p
    }
}

/// The tooltip card (tooltipCardCss + rows).
struct AWCChartTooltipCard: View {
    let model: AWCChartHoverModel
    let fontSize: Double
    let tokens: [String: String]
    var body: some View {
        let bg = awcChartToken(tokens, "--md-sys-color-surface-container-high", "#ECE6F0")
        let ink = awcChartToken(tokens, "--md-sys-color-on-surface", "#1C1B1F")
        VStack(alignment: .leading, spacing: 0) {
            if let custom = model.customText {
                Text(custom).font(.custom(awcChartFontName(weight: 400), fixedSize: fontSize))
            } else {
                Text(model.header).font(.custom(awcChartFontName(weight: 600), fixedSize: fontSize)).padding(.bottom, 4).fixedSize()
                ForEach(Array(model.rows.enumerated()), id: \.offset) { _, r in
                    HStack(spacing: 8) {
                        RoundedRectangle(cornerRadius: r.color == nil ? 0 : 3).fill(r.color.map { Color(awcChartCSS: $0) } ?? .clear).frame(width: 10, height: 10)
                        Text(r.label).font(.custom(awcChartFontName(weight: 400), fixedSize: fontSize)).frame(maxWidth: .infinity, alignment: .leading).fixedSize()
                        Text(r.value).font(.custom(awcChartFontName(weight: r.color == nil ? 400 : 700), fixedSize: fontSize)).fixedSize()
                    }
                    .frame(height: fontSize * 1.5)
                    .opacity(r.color == nil ? 0.62 : 1)
                }
            }
        }
        .foregroundColor(Color(awcChartCSS: ink))
        .padding(.vertical, 8).padding(.horizontal, 10)
        .frame(minWidth: model.customText == nil ? 96 : nil, alignment: .leading)
        .background(Color(awcChartCSS: bg), in: RoundedRectangle(cornerRadius: 8))
        .shadow(color: .black.opacity(0.15), radius: 3, x: 0, y: 2)
        .shadow(color: .black.opacity(0.2), radius: 1, x: 0, y: 1)
        .fixedSize()
        .allowsHitTesting(false)
    }
}
