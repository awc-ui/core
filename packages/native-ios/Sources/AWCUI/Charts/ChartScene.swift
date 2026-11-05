import Foundation

// Port of engine/scene.ts (the backend-agnostic RenderScene) and engine/geometry.ts.
// Colour fields stay CSS strings exactly as the Web engine produces them, so a native scene can be
// diffed against the Web oracle's `scene`; the native renderers parse them when drawing.

struct AWCChartPt: Equatable { var x: Double; var y: Double }
struct AWCChartRect: Equatable { var x: Double; var y: Double; var width: Double; var height: Double }

/// A series cell: a number, `null` (a gap) or `undefined` (a hole the line bridges).
enum AWCChartCell: Equatable {
    case num(Double), null, hole
    var finite: Double? { if case .num(let v) = self, v.isFinite { return v }; return nil }
    var isHole: Bool { self == .hole }
    var raw: Double? { if case .num(let v) = self { return v }; return nil }
}

/// A stacked band per row: [lo, hi], null (gap) or undefined (hole).
enum AWCChartBandCell { case band(Double, Double), null, hole
    var band: (Double, Double)? { if case .band(let a, let b) = self { return (a, b) }; return nil }
}

struct AWCChartPolyline { var points: [AWCChartPt]; var color: String; var width: Double; var dash: [Double]?; var seriesIndex: Int?; var radial: Bool?; var cap: String? }
struct AWCChartSceneBand { var x, y, w, h: Double; var color: String }
struct AWCChartSceneArea { var points: [AWCChartPt]; var baselineY: Double; var colorTop: String; var colorBottom: String; var basePoints: [AWCChartPt]?; var horizontal: Bool?; var seriesIndex: Int? }
struct AWCChartEndLabel { var key: String; var x, y: Double; var text: String; var color: String; var size: Double; var visible: Bool; var side: String? }
struct AWCChartSceneMarker { var x, y, r: Double; var color: String; var symbol: String?; var seriesIndex: Int?; var hollow: Bool?; var fill: String? }
struct AWCChartGlyphLabel { var color: String; var weight: Double; var dx, dy: Double; var anchorX, anchorY: String }
struct AWCChartGlyph { var x, y: Double; var text: String; var size: Double; var label: AWCChartGlyphLabel? }
struct AWCChartSceneBar { var x, y, w, h: Double; var color: String; var radius: [Double]; var seriesIndex: Int; var dataIndex: Int; var horizontal: Bool?; var arrow: Int?; var notch: Bool? }
struct AWCChartSceneSlice {
    var cx, cy, innerR, outerR, startAngle, endAngle: Double; var color: String; var dataIndex: Int; var seriesIndex: Int?
    var cornerRadius: Double?; var gap: Double?; var gapColor: String?; var gradient: (from: String, to: String)?; var pill: Bool?; var capStart: Bool?; var capEnd: Bool?
}
struct AWCChartSceneRipple { var dataIndex: Int; var x, y, radius: Double; var color: String; var alpha: Double }
struct AWCChartSegment { var x1, y1, x2, y2: Double; var color: String; var width: Double; var dash: [Double]? }
struct AWCChartBarLabel { var seriesIndex: Int; var dataIndex: Int; var text: String; var color: String; var size: Double; var fontWeight: Double?; var inside: Bool?; var atLowEnd: Bool? }
struct AWCChartTextItem { var x, y: Double; var text: String; var color: String; var fontSize: Double; var fontWeight: Double?; var align: String; var baseline: String; var rotate: Double?; var key: String }
struct AWCChartHoverPoint { var x, y, value: Double; var low: Double?; var high: Double?; var symbol: String?; var color: String? }
struct AWCChartHoverSeries { var seriesIndex: Int; var color: String; var label: String; var unanchored: Bool?; var byIndex: [Int: AWCChartHoverPoint]; var values: [AWCChartCell]?; var valueFormat: ((Double) -> String)? }
struct AWCChartLegendItem { var label: String; var color: String; var seriesIndex: Int; var hidden: Bool; var x: Double; var y: Double }

struct AWCChartScene {
    var barBaseline: Double?
    var width: Double
    var height: Double
    var plot: AWCChartRect
    var background: String?
    var bands: [AWCChartSceneBand]? = []
    var gridlines: [AWCChartSegment] = []
    var axisLines: [AWCChartSegment] = []
    var areas: [AWCChartSceneArea] = []
    var bars: [AWCChartSceneBar] = []
    var slices: [AWCChartSceneSlice] = []
    var lines: [AWCChartPolyline] = []
    var markers: [AWCChartSceneMarker] = []
    var glyphs: [AWCChartGlyph]? = nil
    var endLabels: [AWCChartEndLabel]? = nil
    var texts: [AWCChartTextItem] = []
    var barLabels: [AWCChartBarLabel]? = nil
    var legend: [AWCChartLegendItem] = []
    var legendPosition: String? = nil
    var pieCenterSlot: AWCChartPt? = nil
    var pieCenter: AWCChartPt? = nil
    var pieHoleSize: Double? = nil
    var pieHoleHeight: Double? = nil
    var inverted: Bool? = nil
    var polar: Bool? = nil
    var xPositions: [Double] = []
    var xValues: [AWCChartAxisValue] = []
    var xLabels: [String] = []
    var hoverPoints: [AWCChartHoverSeries] = []
    var ripple: AWCChartSceneRipple? = nil
}

let AWC_LEGEND_SIDE_MAX_FRACTION = 0.3

// MARK: geometry.ts

private let awcMarkerAngles: [String: [Double]] = ["square": [45, 135, 225, 315], "diamond": [0, 90, 180, 270], "triangle": [-90, 150, 30], "triangle-down": [90, -30, 210]]

func awcChartMarkerPolygon(_ symbol: String?, _ cx: Double, _ cy: Double, _ r: Double) -> [AWCChartPt]? {
    guard let s = symbol, let angles = awcMarkerAngles[s] else { return nil }
    return angles.map { deg in let a = (deg * Double.pi) / 180; return AWCChartPt(x: cx + r * cos(a), y: cy + r * sin(a)) }
}

private let AWC_CURVE_SAMPLES = 20
private let AWC_DECIMATE_PER_PX = 4

func awcChartDecimateMinMax(_ points: [AWCChartPt], _ plotWidth: Double) -> [AWCChartPt] {
    let width = Swift.max(1, Int(plotWidth.rounded(.down)))
    if points.count <= width * AWC_DECIMATE_PER_PX { return points }
    var out: [AWCChartPt] = []
    var col = awcJSRound(points[0].x)
    var firstI = 0, lastI = 0, minI = 0, maxI = 0
    func flush() {
        let picked = [firstI, minI < maxI ? minI : maxI, minI < maxI ? maxI : minI, lastI]
        var prev = -1
        for i in picked { if i != prev { out.append(points[i]) }; prev = i }
    }
    for i in 1..<points.count {
        let c = awcJSRound(points[i].x)
        if c != col { flush(); col = c; firstI = i; minI = i; maxI = i }
        else {
            if points[i].y < points[minI].y { minI = i }
            if points[i].y > points[maxI].y { maxI = i }
        }
        lastI = i
    }
    flush()
    return out
}

func awcChartClampToRect(_ points: [AWCChartPt], _ x: Double, _ y: Double, _ w: Double, _ h: Double) -> [AWCChartPt] {
    let x2 = x + w, y2 = y + h
    guard points.contains(where: { $0.x < x || $0.x > x2 || $0.y < y || $0.y > y2 }) else { return points }
    return points.map { p in AWCChartPt(x: p.x < x ? x : p.x > x2 ? x2 : p.x, y: p.y < y ? y : p.y > y2 ? y2 : p.y) }
}

func awcChartInterpolate(_ points: [AWCChartPt], _ curve: String) -> [AWCChartPt] {
    if points.count < 2 { return points }
    switch curve {
    case "linear": return points
    case "step", "step-before", "step-middle": return awcStepPoints(points, curve)
    case "monotone": return awcMonotone(points)
    default: return awcCatmullRom(points)
    }
}

private func awcStepPoints(_ pts: [AWCChartPt], _ mode: String) -> [AWCChartPt] {
    var out = [pts[0]]
    for i in 1..<pts.count {
        let a = pts[i - 1], b = pts[i]
        if mode == "step" { out.append(AWCChartPt(x: b.x, y: a.y)); out.append(b) }
        else if mode == "step-before" { out.append(AWCChartPt(x: a.x, y: b.y)); out.append(b) }
        else { let mx = (a.x + b.x) / 2; out.append(AWCChartPt(x: mx, y: a.y)); out.append(AWCChartPt(x: mx, y: b.y)); out.append(b) }
    }
    return out
}

private func awcCatmullRom(_ pts: [AWCChartPt]) -> [AWCChartPt] {
    var out = [pts[0]]
    for i in 0..<(pts.count - 1) {
        let p0 = i > 0 ? pts[i - 1] : pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = i + 2 < pts.count ? pts[i + 2] : p2
        for s in 1...AWC_CURVE_SAMPLES {
            let t = Double(s) / Double(AWC_CURVE_SAMPLES), t2 = t * t, t3 = t2 * t
            let x = 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3)
            let y = 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3)
            out.append(AWCChartPt(x: x, y: y))
        }
    }
    return out
}

private func awcMonotone(_ pts: [AWCChartPt]) -> [AWCChartPt] {
    let n = pts.count
    var dx: [Double] = [], slope: [Double] = []
    for i in 0..<(n - 1) {
        let d = pts[i + 1].x - pts[i].x
        let h = d == 0 || d.isNaN ? 1e-6 : d
        dx.append(h); slope.append((pts[i + 1].y - pts[i].y) / h)
    }
    var m = [slope[0]]
    if n > 2 { for i in 1..<(n - 1) {
        if slope[i - 1] * slope[i] <= 0 { m.append(0) }
        else { let w1 = 2 * dx[i] + dx[i - 1], w2 = dx[i] + 2 * dx[i - 1]; m.append((w1 + w2) / (w1 / slope[i - 1] + w2 / slope[i])) }
    } }
    m.append(slope[n - 2])
    var out = [pts[0]]
    for i in 0..<(n - 1) {
        let p0 = pts[i], p1 = pts[i + 1], h = dx[i]
        for s in 1...AWC_CURVE_SAMPLES {
            let t = Double(s) / Double(AWC_CURVE_SAMPLES), t2 = t * t, t3 = t2 * t
            let h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = -2 * t3 + 3 * t2, h11 = t3 - t2
            out.append(AWCChartPt(x: p0.x + t * h, y: h00 * p0.y + h10 * h * m[i] + h01 * p1.y + h11 * h * m[i + 1]))
        }
    }
    return out
}

struct AWCChartRunPoint { var index: Int; var value: Double }

func awcChartSplitRuns(_ data: [AWCChartCell], _ connectNulls: Bool) -> [[AWCChartRunPoint]] {
    var runs: [[AWCChartRunPoint]] = [], current: [AWCChartRunPoint] = []
    for (i, v) in data.enumerated() {
        if v.isHole { continue }
        guard let f = v.finite else {
            if connectNulls { continue }
            if !current.isEmpty { runs.append(current); current = [] }
            continue
        }
        current.append(AWCChartRunPoint(index: i, value: f))
    }
    if !current.isEmpty { runs.append(current) }
    return runs
}

func awcChartStackSeries(_ seriesData: [[AWCChartCell]], _ mode: String, _ stackKeys: [String?]) -> [[AWCChartBandCell]] {
    let rows = seriesData.map(\.count).max() ?? 0
    var out: [[AWCChartBandCell]] = seriesData.map { _ in [] }
    let centred = mode == "silhouette" || mode == "wiggle"
    // JS arrays assigned out of order: we always fill r in order, so append works; missing → hole.
    for r in 0..<Swift.max(0, rows) {
        var signedTotal: [String: Double] = [:], posTotal: [String: Double] = [:], negTotal: [String: Double] = [:]
        for si in 0..<seriesData.count {
            let v = r < seriesData[si].count ? seriesData[si][r] : .hole
            let k = stackKeys[si] ?? "stacked"
            guard k != "__unstacked__", let f = v.finite else { continue }
            signedTotal[k, default: 0] += f
            if f >= 0 { posTotal[k, default: 0] += f } else { negTotal[k, default: 0] += -f }
        }
        var posCursor: [String: Double] = [:], negCursor: [String: Double] = [:]
        for si in 0..<seriesData.count {
            let raw = r < seriesData[si].count ? seriesData[si][r] : .hole
            if raw.isHole { out[si].append(.hole); continue }
            guard let rv = raw.finite else { out[si].append(.null); continue }
            let key = stackKeys[si] ?? "stacked"
            let stacked = mode != "none" && key != "__unstacked__"
            if !stacked { out[si].append(.band(0, rv)); continue }
            let base = centred ? -(signedTotal[key] ?? 0) / 2 : 0
            if posCursor[key] == nil { posCursor[key] = base }
            if negCursor[key] == nil { negCursor[key] = base }
            let pos = posTotal[key] ?? 0, neg = negTotal[key] ?? 0
            var v = rv
            if mode == "percentage" { v = rv >= 0 ? (pos > 0 ? (rv / pos) * 100 : 0) : (neg > 0 ? (rv / neg) * 100 : 0) }
            if v >= 0 { let c = posCursor[key]!; out[si].append(.band(c, c + v)); posCursor[key] = c + v }
            else { let c = negCursor[key]!; out[si].append(.band(c + v, c)); negCursor[key] = c + v }
        }
    }
    return out
}
