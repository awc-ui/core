import Foundation

// Port of engine/layout.ts: spec + theme + size → RenderScene for line/area charts and sparklines.

struct AWCChartEngineTheme {
    var background: String
    var textColor: String
    var textColorMuted: String
    var axisLineColor: String
    var gridLineColor: String
    var surface: String
    var fontFamily: String
    var labelSize: Double
    var titleSize: Double
}

struct AWCChartLineSeriesSpec {
    var label: String
    var color: String
    var data: [AWCChartCell]
    var fill: Bool? = nil
    var stroke: Bool? = nil
    var range: [(Double, Double)?]? = nil   // nil entry = gap; shorter array = holes
    var curve: String = "smooth"
    var connectNulls = false
    var showMarks = false
    var hidden = false
    var symbol: String? = nil
    var pointSymbols: [Int: String]? = nil
    var markIndices: [Int]? = nil
    var dash: String? = nil
    var yAxisIndex: Int? = nil
    var dashAfter: Int? = nil
    var hollow: Bool? = nil
    var lineWidth: Double? = nil
    var markSize: Double? = nil
}

struct AWCChartMarkLineSpec { var value: AWCChartAxisValue; var label: String?; var color: String?; var dash: String? }

struct AWCChartAxisBandSpec { var from: AWCChartAxisValue; var to: AWCChartAxisValue; var color: String?; var label: String?; var labelAlign: String?; var labelColor: String? }

struct AWCChartValueAxisSpec {
    var scale: AWCChartScaleType = .value
    var min: Double? = nil
    var max: Double? = nil
    var formatter: (Double) -> String
    var label: String? = nil
    var position: String? = nil
    var hidden: Bool? = nil
    var hideTicks: Bool? = nil
    var color: String? = nil
    var bands: [AWCChartAxisBandSpec]? = nil
    var dash: String? = nil
    var gridDash: String? = nil
    var breaks: AWCChartAxisBreaks? = nil
}

struct AWCChartRefBand { var from: Double; var to: Double; var color: String }

struct AWCChartLineSpec {
    var series: [AWCChartLineSeriesSpec]
    var title: String? = nil
    var subtitle: String? = nil
    var titleAlign: String? = nil
    var markLines: [AWCChartMarkLineSpec]? = nil
    var xValues: [AWCChartAxisValue] = []
    var xScale: AWCChartScaleType = .category
    var xFormatter: (AWCChartAxisValue) -> String = { awcChartDefaultAxisString($0) }
    var xLabel: String? = nil
    var xHidden: Bool? = nil
    var xHideTicks: Bool? = nil
    var xDash: String? = nil
    var xGridDash: String? = nil
    var yScale: AWCChartScaleType = .value
    var yMin: Double? = nil
    var yMax: Double? = nil
    var yFormatter: (Double) -> String = { awcJSNumberString($0) }
    var yTickFormatter: ((Double) -> String)? = nil
    var yLabel: String? = nil
    var yHidden: Bool? = nil
    var yHideTicks: Bool? = nil
    var yDash: String? = nil
    var yGridDash: String? = nil
    var yReverse: Bool? = nil
    var yAxes: [AWCChartValueAxisSpec]? = nil
    var stack: String = "none"
    var area = false
    var fillOpacity: Double? = nil
    var legend: String? = nil
    var legendExtent: Double? = nil
    var compact: Bool? = nil
    var refBands: [AWCChartRefBand]? = nil
    var xBands: [AWCChartAxisBandSpec]? = nil
    var xBreaks: AWCChartAxisBreaks? = nil
    var yBreaks: AWCChartAxisBreaks? = nil
    var yBands: [AWCChartAxisBandSpec]? = nil
    var gridY: Bool? = nil
    var gridX: Bool? = nil
    var axisTicks: Bool? = nil
    var showLabels: Bool? = nil
    var seriesLabels: Bool? = nil
    var inverted: Bool? = nil
    var animation: String? = nil
    var animationDuration: Double? = nil
    var animate: Bool? = nil
}

/// `String(value)` for an axis value (Dates use JS Date.prototype.toString in the local zone).
func awcChartDefaultAxisString(_ v: AWCChartAxisValue) -> String {
    switch v {
    case .number(let n): return awcJSNumberString(n)
    case .string(let s): return s
    case .date(let ms):
        let f = DateFormatter(); f.locale = Locale(identifier: "en_US_POSIX"); f.timeZone = .current
        f.dateFormat = "EEE MMM dd yyyy HH:mm:ss 'GMT'xx"
        let d = Date(timeIntervalSince1970: ms / 1000)
        return f.string(from: d) + " (" + (TimeZone.current.localizedName(for: TimeZone.current.isDaylightSavingTime(for: d) ? .daylightSaving : .standard, locale: Locale(identifier: "en_US")) ?? "") + ")"
    }
}

/// JS `Number(value)` for an axis value.
func awcChartNumberOf(_ v: AWCChartAxisValue) -> Double {
    switch v { case .number(let n): return n; case .date(let ms): return ms; case .string(let s): return awcJSNumber(s) }
}

func awcChartHasAnchor(_ s: AWCChartLineSeriesSpec) -> Bool {
    let strokes = s.range == nil && s.stroke != false
    let marks = s.showMarks || !(s.markIndices?.isEmpty ?? true) || s.pointSymbols != nil
    return strokes || marks
}

let AWC_AXIS_TICK_LEN = 5.0

/// layout.ts `approxWidth`: UTF-16 length × size × 0.58 (deterministic, no font metrics).
func awcChartApproxWidth(_ text: String, _ fontSize: Double) -> Double { Double(text.utf16.count) * fontSize * 0.58 }

func awcChartEstimateLegendRows(_ labels: [String], _ fontSize: Double, _ availW: Double) -> Int {
    var rows = 1; var rowW = 0.0
    for label in labels {
        let iw = awcChartApproxWidth(label, fontSize) + 28
        if rowW > 0 && rowW + iw > availW { rows += 1; rowW = iw } else { rowW += iw }
    }
    return rows
}

func awcChartDashPattern(_ dash: String?, _ width: Double = 1) -> [Double]? {
    if dash == "dashed" { return [width * 3.5, width * 3] }
    if dash == "dotted" { return [Swift.max(1, width * 0.4), width * 2.6] }
    return nil
}

private let AWC_BREAK_WAVE_LEN = 30.0, AWC_BREAK_WAVE_STEP = 3.0, AWC_BREAK_WAVE_AMP = 4.0

func awcChartBreakBandSegments(_ axis: String, _ gapLo: Double, _ gapHi: Double, _ spanFrom: Double, _ spanTo: Double, _ color: String) -> [AWCChartSegment] {
    var segs: [AWCChartSegment] = []
    let len = spanTo - spanFrom
    if len <= 0 { return segs }
    let mid = (gapLo + gapHi) / 2
    let amp = Swift.min(AWC_BREAK_WAVE_AMP, (gapHi - gapLo) / 2)
    let n = Swift.max(4, Int(awcJSRound(len / AWC_BREAK_WAVE_STEP)))
    func at(_ i: Int) -> (p: Double, off: Double) { let p = spanFrom + (len * Double(i)) / Double(n); return (p, mid + amp * sin((p / AWC_BREAK_WAVE_LEN) * Double.pi * 2)) }
    var prev = at(0)
    for i in 1...n {
        let cur = at(i)
        segs.append(axis == "y" ? AWCChartSegment(x1: prev.p, y1: prev.off, x2: cur.p, y2: cur.off, color: color, width: 1.5, dash: nil)
                                : AWCChartSegment(x1: prev.off, y1: prev.p, x2: cur.off, y2: cur.p, color: color, width: 1.5, dash: nil))
        prev = cur
    }
    return segs
}

func awcChartAxisLineWithBreaks(_ axis: String, _ from: Double, _ to: Double, _ along: Double, _ breaks: [(px: Double, gap: Double)], _ color: String, _ dash: [Double]?) -> [AWCChartSegment] {
    var segs: [AWCChartSegment] = []
    var cursor = from
    func seg(_ a: Double, _ b: Double) -> AWCChartSegment {
        axis == "y" ? AWCChartSegment(x1: along, y1: a, x2: along, y2: b, color: color, width: 1, dash: dash) : AWCChartSegment(x1: a, y1: along, x2: b, y2: along, color: color, width: 1, dash: dash)
    }
    for b in breaks { let start = from + b.px; if start > cursor { segs.append(seg(cursor, start)) }; cursor = start + b.gap }
    if to > cursor { segs.append(seg(cursor, to)) }
    return segs
}

private let AWC_BAND_LABEL_PAD = 8.0

func awcChartBuildAxisBands(_ bands: [AWCChartAxisBandSpec]?, _ axis: String, _ toPx: (AWCChartAxisValue) -> Double, _ plot: AWCChartRect, _ theme: AWCChartEngineTheme, _ keyPrefix: String) -> (rects: [AWCChartSceneBand], labels: [AWCChartTextItem]) {
    var rects: [AWCChartSceneBand] = [], labels: [AWCChartTextItem] = []
    guard let bands, !bands.isEmpty else { return (rects, labels) }
    let horizontal = axis == "y"
    let lo = horizontal ? plot.y : plot.x
    let hi = horizontal ? plot.y + plot.height : plot.x + plot.width
    for (i, b) in bands.enumerated() {
        let a = toPx(b.from), z = toPx(b.to)
        if !a.isFinite || !z.isFinite { continue }
        let start = Swift.max(lo, Swift.min(a, z)), end = Swift.min(hi, Swift.max(a, z))
        if end <= start { continue }
        let color = b.color ?? awcChartHexToRgba(theme.axisLineColor, 0.07)
        rects.append(horizontal ? AWCChartSceneBand(x: plot.x, y: start, w: plot.width, h: end - start, color: color) : AWCChartSceneBand(x: start, y: plot.y, w: end - start, h: plot.height, color: color))
        guard let label = b.label, !label.isEmpty else { continue }
        let align = b.labelAlign ?? "start"
        let along = align == "center" ? (horizontal ? plot.x + plot.width / 2 : plot.y + plot.height / 2)
            : align == "end" ? (horizontal ? plot.x + plot.width - AWC_BAND_LABEL_PAD : plot.y + plot.height - AWC_BAND_LABEL_PAD)
            : (horizontal ? plot.x + AWC_BAND_LABEL_PAD : plot.y + AWC_BAND_LABEL_PAD)
        labels.append(AWCChartTextItem(x: horizontal ? along : start + AWC_BAND_LABEL_PAD, y: horizontal ? start + AWC_BAND_LABEL_PAD : along, text: label, color: b.labelColor ?? theme.textColorMuted, fontSize: theme.labelSize, fontWeight: nil,
                                       align: horizontal ? (align == "center" ? "center" : align) : "start", baseline: horizontal ? "top" : align == "center" ? "middle" : align == "end" ? "bottom" : "top", rotate: nil, key: "\(keyPrefix)-\(i)"))
    }
    return (rects, labels)
}

let AWC_GLYPH_SIZE = 18.0
private let awcShapeSymbols: Set<String> = ["circle", "square", "diamond", "triangle", "triangle-down"]
func awcChartIsShapeSymbol(_ s: String) -> Bool { awcShapeSymbols.contains(s) }
func awcChartMarkerRadius(_ symbol: String?, _ override: Double?) -> Double {
    if let o = override, o > 0 { return o }
    if symbol == "square" || symbol == "diamond" { return 4.2 }
    if symbol == "triangle" || symbol == "triangle-down" { return 4.6 }
    return 3.5
}

func awcChartTitlePlacement(_ align: String?, _ plotX: Double, _ plotWidth: Double) -> (x: Double, align: String) {
    if align == "center" { return (plotX + plotWidth / 2, "center") }
    if align == "end" { return (plotX + plotWidth, "end") }
    return (plotX, "start")
}

/// JS `Math.max(0, ...xs)` / `Math.max(...xs)` with -Infinity for an empty list.
@inline(__always) func awcMax(_ base: Double, _ xs: [Double]) -> Double { xs.reduce(base) { Swift.max($0, $1) } }

func awcChartComputeLayout(_ spec: AWCChartLineSpec, _ theme: AWCChartEngineTheme, _ width: Double, _ height: Double) -> AWCChartScene {
    if spec.inverted == true { return awcChartComputeInvertedLayout(spec, theme, width, height) }
    if let axes = spec.yAxes, !axes.isEmpty { return awcChartComputeMultiAxisLayout(spec, theme, width, height) }
    let rows = !spec.xValues.isEmpty ? spec.xValues.count : Int(awcMax(0, spec.series.map { Double($0.data.count) }))
    let stackKeys: [String?] = spec.series.map { spec.stack != "none" && $0.range == nil ? "stacked" : "__unstacked__" }
    var bands = awcChartStackSeries(spec.series.map { $0.hidden ? [] : $0.data }, spec.stack, stackKeys)
    for (si, s) in spec.series.enumerated() where s.range != nil && !s.hidden {
        bands[si] = s.range!.map { r in r.map { .band(Swift.min($0.0, $0.1), Swift.max($0.0, $0.1)) } ?? .null }
    }
    var yVals: [Double] = []
    for (si, s) in spec.series.enumerated() where !s.hidden { for b in bands[si] { if let (a, z) = b.band { yVals.append(a); yVals.append(z) } } }
    let yDomain = awcComputeDomain(yVals, min: spec.yMin, max: spec.yMax, scale: spec.yScale, includeZero: spec.stack != "none" || spec.yScale == .value)
    let xNums = spec.xValues.map { awcChartToNumeric($0, spec.xScale) }
    let xDomain = awcComputeDomain(xNums, scale: spec.xScale)
    let compact = spec.compact == true
    let yFound = compact ? ([], .equal) : awcResolveAxisBreaks(spec.yBreaks, yVals, spec.yScale)
    let xFound = compact || spec.xScale == .category ? ([], .equal) : awcResolveAxisBreaks(spec.xBreaks, xNums, spec.xScale)
    let yBreakRanges = awcNormalizeBreaks(yFound.ranges, yDomain)
    let xBreakRanges = awcNormalizeBreaks(xFound.ranges, xDomain)
    let yTickVals = awcSectionedTicks(yDomain, yBreakRanges, spec.yScale, 6).filter { !awcInBreak(yBreakRanges, $0) }
    let yTickLabels = yTickVals.map { (spec.yTickFormatter ?? spec.yFormatter)($0) }
    let maxYLabelW = spec.yHidden == true || spec.yHideTicks == true ? 0 : awcMax(0, yTickLabels.map { awcChartApproxWidth($0, theme.labelSize) })

    let subtitleH = (spec.subtitle?.isEmpty == false) ? theme.labelSize + 4 : 0
    let titleH = (spec.title?.isEmpty == false) ? theme.titleSize + 10 + subtitleH : 0
    let xLabelH = spec.xHidden == true || spec.xHideTicks == true ? 0 : theme.labelSize + 8
    let yAxisLabelW = (spec.yLabel?.isEmpty == false) ? theme.labelSize + 6 : 0
    let xAxisLabelH = (spec.xLabel?.isEmpty == false) ? theme.labelSize + 6 : 0

    let legendActive = (spec.legend?.isEmpty == false) && spec.legend != "none" && spec.series.count > 1
    let legendSide = legendActive && (spec.legend == "left" || spec.legend == "right")
    let legendAtBottom = legendActive && !legendSide && spec.legend!.hasPrefix("bottom")
    let legendTopRow = legendActive && !legendSide && !legendAtBottom
    let legendRows = legendTopRow || legendAtBottom ? awcChartEstimateLegendRows(spec.series.map(\.label), theme.labelSize, width * 0.86) : 1
    let legendBandH = spec.legendExtent != nil && (legendTopRow || legendAtBottom) ? spec.legendExtent! + 8 : Double(legendRows) * (theme.labelSize + 8) + 6
    let legendBandTop = legendTopRow ? legendBandH : 0
    let legendBandBottom = legendAtBottom ? legendBandH : 0
    let legendSideW = legendSide ? (spec.legendExtent != nil ? spec.legendExtent! + 16 : awcMax(0, spec.series.map { awcChartApproxWidth($0.label, theme.labelSize) }) + 34) : 0
    let seriesLabelW = spec.seriesLabels == true ? awcMax(0, spec.series.filter { !$0.hidden }.map { awcChartApproxWidth($0.label, theme.labelSize) }) + 20 : 0

    let markPad = compact ? awcMax(2, spec.series.filter { !$0.hidden && ($0.showMarks || ($0.markIndices?.count ?? 0) > 0 || $0.pointSymbols != nil) }.map { awcChartMarkerRadius($0.symbol, $0.markSize) + 2 }) : 0
    let padTop = compact ? markPad : titleH + 8 + legendBandTop
    let padRight = compact ? markPad : 12 + awcChartApproxWidth(yTickLabels.last ?? "", theme.labelSize) / 2 + (spec.legend == "right" ? legendSideW : 0) + seriesLabelW
    let padBottom = compact ? markPad : xLabelH + xAxisLabelH + 6 + legendBandBottom
    let padLeft = compact ? markPad : maxYLabelW + 10 + yAxisLabelW + (spec.legend == "left" ? legendSideW : 0)
    let plot = AWCChartRect(x: padLeft, y: padTop, width: Swift.max(1, width - padLeft - padRight), height: Swift.max(1, height - padTop - padBottom))

    let x = spec.xScale == .category ? awcMakeCategoryScale(rows, plot.width, true) : awcMakeBrokenScale(xDomain, plot.width, spec.xScale, xBreakRanges, xFound.sizing)
    let y = awcMakeBrokenScale(yDomain, plot.height, spec.yScale, yBreakRanges, yFound.sizing)
    func toPxY(_ v: Double) -> Double { plot.y + plot.height - y.scale(v) }
    // JS: toNumeric(undefined) is 0 for value/time/log axes.
    func toPxX(_ i: Int) -> Double { plot.x + (spec.xScale == .category ? x.scale(Double(i)) : x.scale(i >= 0 && i < xNums.count ? xNums[i] : 0)) }
    func toPxXf(_ i: Double) -> Double {
        if spec.xScale == .category { return plot.x + x.scale(i) }
        return plot.x + x.scale(i == i.rounded(.down) && i >= 0 && i < Double(xNums.count) ? xNums[Int(i)] : 0)
    }

    var bandLabels: [AWCChartTextItem] = []
    var axisBands: [AWCChartSceneBand] = []
    if !compact {
        let onY = awcChartBuildAxisBands(spec.yBands, "y", { toPxY(awcChartToNumeric($0, spec.yScale)) }, plot, theme, "yband")
        let onX = awcChartBuildAxisBands(spec.xBands, "x", { plot.x + x.scale(spec.xScale == .category ? awcChartNumberOf($0) : awcChartToNumeric($0, spec.xScale)) }, plot, theme, "xband")
        axisBands += onY.rects + onX.rects
        bandLabels += onY.labels + onX.labels
    }
    var gridlines: [AWCChartSegment] = [], axisLines: [AWCChartSegment] = []
    let yGridDash = awcChartDashPattern(spec.yGridDash, 1), xGridDash = awcChartDashPattern(spec.xGridDash, 1)
    let yAxisDash = awcChartDashPattern(spec.yDash, 1), xAxisDash = awcChartDashPattern(spec.xDash, 1)
    if spec.yHidden != true && !compact {
        for t in yTickVals {
            let py = toPxY(t)
            if spec.gridY != false { gridlines.append(AWCChartSegment(x1: plot.x, y1: py, x2: plot.x + plot.width, y2: py, color: theme.gridLineColor, width: 1, dash: yGridDash)) }
            if spec.axisTicks == true { axisLines.append(AWCChartSegment(x1: plot.x - AWC_AXIS_TICK_LEN, y1: py, x2: plot.x, y2: py, color: theme.axisLineColor, width: 1, dash: yAxisDash)) }
        }
        let yCuts = y.breaks.map { (px: plot.height - $0.px - $0.gap, gap: $0.gap) }
        axisLines += awcChartAxisLineWithBreaks("y", plot.y, plot.y + plot.height, plot.x, yCuts, theme.axisLineColor, yAxisDash)
        for c in yCuts { axisLines += awcChartBreakBandSegments("y", plot.y + c.px, plot.y + c.px + c.gap, plot.x, plot.x + plot.width, theme.axisLineColor) }
    }
    if spec.xHidden != true && !compact {
        let yb = plot.y + plot.height
        let xCuts = x.breaks.map { (px: $0.px, gap: $0.gap) }
        axisLines += awcChartAxisLineWithBreaks("x", plot.x, plot.x + plot.width, yb, xCuts, theme.axisLineColor, xAxisDash)
        for c in xCuts { axisLines += awcChartBreakBandSegments("x", plot.x + c.px, plot.x + c.px + c.gap, plot.y, plot.y + plot.height, theme.axisLineColor) }
    }

    var lines: [AWCChartPolyline] = [], areas: [AWCChartSceneArea] = [], markers: [AWCChartSceneMarker] = [], glyphs: [AWCChartGlyph] = []
    var endLabelCands: [AWCChartEndLabel] = [], hoverPoints: [AWCChartHoverSeries] = []
    let baselineY = toPxY(Swift.max(yDomain.0, 0))

    func splitAtBreaks(_ run: [AWCChartRunPoint]) -> [[AWCChartRunPoint]] {
        if yBreakRanges.isEmpty && xBreakRanges.isEmpty { return [run] }
        var out: [[AWCChartRunPoint]] = [], current: [AWCChartRunPoint] = []
        var prevSection = ""
        for pt in run {
            let xv: Double? = pt.index < xNums.count ? xNums[pt.index] : nil
            if awcInBreak(yBreakRanges, pt.value) || (xv != nil && awcInBreak(xBreakRanges, xv!)) {
                if !current.isEmpty { out.append(current) }
                current = []; prevSection = ""; continue
            }
            let section = "\(yBreakRanges.filter { pt.value >= $0.to }.count):\(xBreakRanges.filter { xv != nil && xv! >= $0.to }.count)"
            if !prevSection.isEmpty && section != prevSection && !current.isEmpty { out.append(current); current = [] }
            prevSection = section
            current.append(pt)
        }
        if !current.isEmpty { out.append(current) }
        return out
    }

    for (si, s) in spec.series.enumerated() {
        if s.hidden { continue }
        let tops: [AWCChartCell] = bands[si].map { b in switch b { case .hole: return .hole; case .null: return .null; case .band(_, let hi): return .num(hi) } }
        let runs = awcChartSplitRuns(tops, s.connectNulls).flatMap(splitAtBreaks)
        var byIndex: [Int: AWCChartHoverPoint] = [:]
        var endPt: AWCChartPt? = nil
        for run in runs {
            if run.isEmpty { continue }
            let raw = run.map { AWCChartPt(x: toPxX($0.index), y: toPxY($0.value)) }
            endPt = raw.last
            for (k, r) in run.enumerated() {
                let hoverSym = s.pointSymbols?[r.index] ?? (s.symbol != nil && s.symbol != "none" && !(s.symbol!.isEmpty) ? s.symbol! : "circle")
                let band: (Double, Double)? = s.range != nil ? bands[si][r.index].band : nil
                let dataV = r.index < s.data.count ? s.data[r.index].raw : nil
                byIndex[r.index] = AWCChartHoverPoint(x: raw[k].x, y: raw[k].y, value: dataV ?? r.value, low: band?.0, high: band?.1, symbol: hoverSym, color: nil)
            }
            let poly = awcChartClampToRect(awcChartInterpolate(awcChartDecimateMinMax(raw, plot.width), s.curve), plot.x, plot.y, plot.width, plot.height)
            let splitAt = s.dashAfter != nil ? (run.firstIndex { $0.index >= s.dashAfter! } ?? -1) : -1
            let lw = s.lineWidth ?? 2.5
            if s.range != nil || s.stroke == false {
            } else if splitAt > 0 && splitAt < run.count {
                lines.append(AWCChartPolyline(points: awcChartClampToRect(awcChartInterpolate(awcChartDecimateMinMax(Array(raw[0...splitAt]), plot.width), s.curve), plot.x, plot.y, plot.width, plot.height), color: s.color, width: lw, dash: awcChartDashPattern(s.dash, lw), seriesIndex: si))
                lines.append(AWCChartPolyline(points: awcChartClampToRect(awcChartInterpolate(awcChartDecimateMinMax(Array(raw[splitAt...]), plot.width), s.curve), plot.x, plot.y, plot.width, plot.height), color: s.color, width: lw, dash: awcChartDashPattern("dotted", lw), seriesIndex: si))
            } else if splitAt == 0 {
                lines.append(AWCChartPolyline(points: poly, color: s.color, width: lw, dash: awcChartDashPattern("dotted", lw), seriesIndex: si))
            } else {
                lines.append(AWCChartPolyline(points: poly, color: s.color, width: lw, dash: awcChartDashPattern(s.dash, lw), seriesIndex: si))
            }
            if spec.area && s.fill != false {
                let fo = spec.fillOpacity ?? 0.35
                let basePoints: [AWCChartPt]? = spec.stack != "none" || s.range != nil
                    ? awcChartClampToRect(awcChartInterpolate(run.map { AWCChartPt(x: toPxX($0.index), y: toPxY(bands[si][$0.index].band?.0 ?? .nan)) }, s.curve), plot.x, plot.y, plot.width, plot.height)
                    : nil
                areas.append(AWCChartSceneArea(points: poly, baselineY: baselineY, colorTop: awcChartHexToRgba(s.color, fo), colorBottom: basePoints != nil ? awcChartHexToRgba(s.color, fo) : awcChartHexToRgba(s.color, Swift.max(0.02, fo * 0.06)), basePoints: basePoints, horizontal: nil, seriesIndex: si))
            }
            let markSet = s.markIndices.map(Set.init)
            for (k, r) in run.enumerated() {
                let idx = r.index
                let override = s.pointSymbols?[idx]
                let showDefault = markSet != nil ? markSet!.contains(idx) : s.showMarks
                let sym = override ?? (showDefault ? (s.symbol ?? "circle") : nil)
                guard let sym, !sym.isEmpty, sym != "none" else { continue }
                let pt = raw[k]
                if awcChartIsShapeSymbol(sym) {
                    markers.append(AWCChartSceneMarker(x: pt.x, y: pt.y, r: awcChartMarkerRadius(sym, s.markSize), color: s.color, symbol: sym, seriesIndex: si, hollow: s.hollow, fill: s.hollow == true ? theme.surface : nil))
                } else { glyphs.append(AWCChartGlyph(x: pt.x, y: pt.y, text: sym, size: AWC_GLYPH_SIZE, label: nil)) }
            }
            if spec.showLabels == true && !compact {
                for (k, r) in run.enumerated() {
                    let above = raw[k].y - 9 - theme.labelSize >= plot.y
                    let dataV = r.index < s.data.count ? s.data[r.index].raw : nil
                    glyphs.append(AWCChartGlyph(x: raw[k].x, y: raw[k].y, text: spec.yFormatter(dataV ?? r.value), size: theme.labelSize,
                                                label: AWCChartGlyphLabel(color: theme.textColor, weight: 600, dx: 0, dy: above ? -9 : 9, anchorX: "-50%", anchorY: above ? "-100%" : "0")))
                }
            }
        }
        if spec.seriesLabels == true, let e = endPt, !compact {
            markers.append(AWCChartSceneMarker(x: e.x, y: e.y, r: 4, color: s.color, symbol: "circle", seriesIndex: si, hollow: nil, fill: nil))
            endLabelCands.append(AWCChartEndLabel(key: "sl-\(si)", x: e.x, y: e.y, text: s.label, color: theme.textColor, size: theme.labelSize + 1, visible: true, side: nil))
        }
        hoverPoints.append(AWCChartHoverSeries(seriesIndex: si, color: s.color, label: s.label, unanchored: !awcChartHasAnchor(s), byIndex: byIndex, values: s.data, valueFormat: nil))
    }
    awcChartResolveEndLabelCollisions(&endLabelCands, theme.labelSize + 5)

    var bars: [AWCChartSceneBar] = []
    if let refBands = spec.refBands {
        for b in refBands {
            let bx1 = toPxXf(b.from), bx2 = toPxXf(b.to)
            let bx = Swift.min(bx1, bx2), bw = abs(bx2 - bx1)
            if bw <= 0 { continue }
            bars.append(AWCChartSceneBar(x: bx, y: plot.y, w: bw, h: plot.height, color: b.color, radius: [0, 0, 0, 0], seriesIndex: -1, dataIndex: -1))
        }
    }
    var texts = bandLabels
    if let title = spec.title, !title.isEmpty, !compact {
        let tt = awcChartTitlePlacement(spec.titleAlign, plot.x, plot.width)
        texts.append(AWCChartTextItem(x: tt.x, y: legendBandTop + 6, text: title, color: theme.textColor, fontSize: theme.titleSize, fontWeight: 600, align: tt.align, baseline: "top", rotate: nil, key: "title"))
        if let sub = spec.subtitle, !sub.isEmpty {
            texts.append(AWCChartTextItem(x: tt.x, y: legendBandTop + 6 + theme.titleSize + 4, text: sub, color: theme.textColorMuted, fontSize: theme.labelSize, fontWeight: nil, align: tt.align, baseline: "top", rotate: nil, key: "subtitle"))
        }
    }
    if let mls = spec.markLines, !compact {
        for ml in mls {
            let mv = spec.xScale == .category ? awcChartNumberOf(ml.value) : awcChartToNumeric(ml.value, spec.xScale)
            let px = plot.x + x.scale(mv)
            if !px.isFinite || px < plot.x - 1 || px > plot.x + plot.width + 1 { continue }
            gridlines.append(AWCChartSegment(x1: px, y1: plot.y, x2: px, y2: plot.y + plot.height, color: ml.color ?? theme.axisLineColor, width: 1.5, dash: awcChartDashPattern(ml.dash ?? "dashed", 1.5)))
            if let l = ml.label, !l.isEmpty {
                texts.append(AWCChartTextItem(x: px + 4, y: plot.y + 2, text: l, color: theme.textColorMuted, fontSize: theme.labelSize, fontWeight: nil, align: "start", baseline: "top", rotate: nil, key: "markline-\(awcJSNumberString(awcJSRound(px)))"))
            }
        }
    }
    if spec.yHidden != true && spec.yHideTicks != true && !compact {
        for (i, t) in yTickVals.enumerated() {
            texts.append(AWCChartTextItem(x: plot.x - 8, y: toPxY(t), text: yTickLabels[i], color: theme.textColorMuted, fontSize: theme.labelSize, fontWeight: nil, align: "end", baseline: "middle", rotate: nil, key: "yt-\(i)"))
        }
    }
    var xPositions: [Double] = []
    for i in 0..<rows { xPositions.append(toPxX(i)) }
    var xAnchors: [(px: Double, text: String, key: String)] = []
    if spec.xScale == .category {
        let step = Swift.max(1, Int((Double(rows) / Double(Swift.max(1, Int((plot.width / 60).rounded(.down))))).rounded(.up)))
        var i = 0
        while i < rows { xAnchors.append((xPositions[i], spec.xFormatter(i < spec.xValues.count ? spec.xValues[i] : .number(Double(i))), "xt-\(i)")); i += step }
    } else if rows > 0 {
        let xd = awcComputeDomain(xNums, scale: spec.xScale)
        let target = Swift.max(2, Int((plot.width / 90).rounded(.down)))
        let xTicks = awcSectionedTicks(xd, xBreakRanges, spec.xScale, target).filter { !awcInBreak(xBreakRanges, $0) }
        for tv in xTicks {
            let px = plot.x + x.scale(tv)
            if px < plot.x - 1 || px > plot.x + plot.width + 1 { continue }
            xAnchors.append((px, spec.xFormatter(spec.xScale == .time ? .date(tv) : .number(tv)), "xt-\(awcJSNumberString(tv))"))
        }
    }
    if !compact {
        for a in xAnchors {
            if spec.gridX == true && a.px > plot.x + 0.5 { gridlines.append(AWCChartSegment(x1: a.px, y1: plot.y, x2: a.px, y2: plot.y + plot.height, color: theme.gridLineColor, width: 1, dash: xGridDash)) }
            if spec.axisTicks == true && spec.xHidden != true { let yb = plot.y + plot.height; axisLines.append(AWCChartSegment(x1: a.px, y1: yb, x2: a.px, y2: yb + AWC_AXIS_TICK_LEN, color: theme.axisLineColor, width: 1, dash: xAxisDash)) }
            if spec.xHidden == true || spec.xHideTicks == true { continue }
            texts.append(AWCChartTextItem(x: a.px, y: plot.y + plot.height + 6, text: a.text, color: theme.textColorMuted, fontSize: theme.labelSize, fontWeight: nil, align: "center", baseline: "top", rotate: nil, key: a.key))
        }
    }
    if let xl = spec.xLabel, !xl.isEmpty, !compact {
        texts.append(AWCChartTextItem(x: plot.x + plot.width / 2, y: height - legendBandBottom - 2, text: xl, color: theme.textColor, fontSize: theme.labelSize, fontWeight: nil, align: "center", baseline: "bottom", rotate: nil, key: "x-axis-title"))
    }
    if let yl = spec.yLabel, !yl.isEmpty, !compact {
        texts.append(AWCChartTextItem(x: 4, y: plot.y + plot.height / 2, text: yl, color: theme.textColor, fontSize: theme.labelSize, fontWeight: nil, align: "center", baseline: "top", rotate: -90, key: "y-axis-title"))
    }
    let legend: [AWCChartLegendItem] = spec.legend == "none" || compact ? [] : spec.series.enumerated().map { AWCChartLegendItem(label: $1.label, color: $1.color, seriesIndex: $0, hidden: $1.hidden, x: 0, y: 0) }
    var xLabels: [String] = []
    for i in 0..<rows { xLabels.append(spec.xFormatter(i < spec.xValues.count ? spec.xValues[i] : .number(Double(i)))) }
    return AWCChartScene(barBaseline: nil, width: width, height: height, plot: plot, background: theme.background == "transparent" ? nil : theme.background,
                         bands: axisBands, gridlines: gridlines, axisLines: axisLines, areas: areas, bars: bars, slices: [], lines: lines, markers: markers,
                         glyphs: glyphs, endLabels: endLabelCands, texts: texts, legend: legend, legendPosition: spec.legend,
                         xPositions: xPositions, xValues: spec.xValues, xLabels: xLabels, hoverPoints: hoverPoints)
}

/// The end-label pass shared by the layouts: sort by y (stable) and hide labels closer than minGap.
func awcChartResolveEndLabelCollisions(_ cands: inout [AWCChartEndLabel], _ minGap: Double) {
    guard cands.count > 1 else { return }
    var lastY = -Double.infinity
    let order = cands.indices.map { $0 }.awcStableSorted { cands[$0].y < cands[$1].y }
    for i in order { cands[i].visible = cands[i].y - lastY >= minGap; if cands[i].visible { lastY = cands[i].y } }
}
