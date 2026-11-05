import Foundation

// Port of layout.ts `computeMultiAxisLayout` (independent value axes stacked outward per side).

func awcChartComputeMultiAxisLayout(_ spec: AWCChartLineSpec, _ theme: AWCChartEngineTheme, _ width: Double, _ height: Double) -> AWCChartScene {
    let axesSpec = spec.yAxes ?? []
    let rows = !spec.xValues.isEmpty ? spec.xValues.count : Int(awcMax(0, spec.series.map { Double($0.data.count) }))
    func axisIndexOf(_ s: AWCChartLineSeriesSpec) -> Int { let i = s.yAxisIndex ?? 0; return i >= 0 && i < axesSpec.count ? i : 0 }
    final class AxisInfo {
        let spec: AWCChartValueAxisSpec; let domain: AWCChartDomain; let tickVals: [Double]; let tickLabels: [String]
        let side: String; let gutterW: Double; let tint: String?; let hasData: Bool
        var scale: AWCChartScale?; var axisX: Double = 0; var toPxY: (Double) -> Double = { $0 }
        init(spec: AWCChartValueAxisSpec, domain: AWCChartDomain, tickVals: [Double], tickLabels: [String], side: String, gutterW: Double, tint: String?, hasData: Bool) {
            self.spec = spec; self.domain = domain; self.tickVals = tickVals; self.tickLabels = tickLabels; self.side = side; self.gutterW = gutterW; self.tint = tint; self.hasData = hasData
        }
    }
    let axes: [AxisInfo] = axesSpec.enumerated().map { ai, a in
        let seriesOn = spec.series.filter { !$0.hidden && axisIndexOf($0) == ai }
        var vals: [Double] = []
        for s in seriesOn { for d in s.data { if case .num(let v) = d, v.isFinite { vals.append(v) } } }
        let domain = awcComputeDomain(vals, min: a.min, max: a.max, scale: a.scale, includeZero: a.scale == .value)
        let tickVals = a.scale == .log ? awcLogTicks(domain.0, domain.1) : awcNiceLinearTicks(domain.0, domain.1, 6)
        let tickLabels = tickVals.map { a.formatter($0) }
        let side = a.position ?? (ai == 0 ? "left" : "right")
        let labelW = a.hidden == true || a.hideTicks == true ? 0 : awcMax(0, tickLabels.map { awcChartApproxWidth($0, theme.labelSize) })
        let titleW = (a.label?.isEmpty == false) ? theme.labelSize + 6 : 0
        let gutterW = a.hidden == true ? 4 : labelW + 12 + titleW
        return AxisInfo(spec: a, domain: domain, tickVals: tickVals, tickLabels: tickLabels, side: side, gutterW: gutterW, tint: a.color, hasData: !seriesOn.isEmpty)
    }
    let leftAxes = axes.filter { $0.side == "left" }, rightAxes = axes.filter { $0.side == "right" }
    func sumGut(_ arr: [AxisInfo]) -> Double { arr.reduce(0) { $0 + $1.gutterW } }
    let titleH = (spec.title?.isEmpty == false) ? theme.titleSize + 10 + ((spec.subtitle?.isEmpty == false) ? theme.labelSize + 4 : 0) : 0
    let xLabelH = spec.xHidden == true || spec.xHideTicks == true ? 0 : theme.labelSize + 8
    let xAxisLabelH = (spec.xLabel?.isEmpty == false) ? theme.labelSize + 6 : 0
    let legendActive = (spec.legend?.isEmpty == false) && spec.legend != "none" && spec.series.count > 1
    let legendSide = legendActive && (spec.legend == "left" || spec.legend == "right")
    let legendAtBottom = legendActive && !legendSide && spec.legend!.hasPrefix("bottom")
    let legendTopRow = legendActive && !legendSide && !legendAtBottom
    let legendRows = legendTopRow || legendAtBottom ? awcChartEstimateLegendRows(spec.series.map(\.label), theme.labelSize, width * 0.86) : 1
    let legendBandH = spec.legendExtent != nil && (legendTopRow || legendAtBottom) ? spec.legendExtent! + 8 : Double(legendRows) * (theme.labelSize + 8) + 6
    let legendBandTop = legendTopRow ? legendBandH : 0, legendBandBottom = legendAtBottom ? legendBandH : 0
    let legendSideW = legendSide ? (spec.legendExtent != nil ? spec.legendExtent! + 16 : awcMax(0, spec.series.map { awcChartApproxWidth($0.label, theme.labelSize) }) + 34) : 0
    let lastXText = spec.xHidden == true || spec.xHideTicks == true ? "" : spec.xFormatter(rows - 1 >= 0 && rows - 1 < spec.xValues.count ? spec.xValues[rows - 1] : .number(Double(rows - 1)))
    let xOverhang = rightAxes.isEmpty ? awcChartApproxWidth(lastXText, theme.labelSize) / 2 : 0
    let padTop = titleH + 8 + legendBandTop
    let padBottom = xLabelH + xAxisLabelH + 6 + legendBandBottom
    let padLeft = sumGut(leftAxes) + 8 + (spec.legend == "left" ? legendSideW : 0)
    let padRight = sumGut(rightAxes) + 8 + xOverhang + (spec.legend == "right" ? legendSideW : 0)
    let plot = AWCChartRect(x: padLeft, y: padTop, width: Swift.max(1, width - padLeft - padRight), height: Swift.max(1, height - padTop - padBottom))
    let xNums = spec.xValues.map { awcChartToNumeric($0, spec.xScale) }
    let x = spec.xScale == .category ? awcMakeCategoryScale(rows, plot.width, true)
        : spec.xScale == .log ? awcMakeLogScale(awcComputeDomain(xNums, scale: .log), plot.width)
        : awcMakeLinearScale(awcComputeDomain(xNums, scale: spec.xScale), plot.width, spec.xScale)
    func toPxX(_ i: Int) -> Double { plot.x + (spec.xScale == .category ? x.scale(Double(i)) : x.scale(i >= 0 && i < xNums.count ? xNums[i] : 0)) }
    func makeAxisScale(_ a: AxisInfo) {
        let sc = a.spec.scale == .log ? awcMakeLogScale(a.domain, plot.height) : awcMakeLinearScale(a.domain, plot.height, a.spec.scale)
        a.scale = sc; a.toPxY = { v in plot.y + plot.height - sc.scale(v) }
    }
    var offL = 0.0
    for a in leftAxes { a.axisX = plot.x - offL; makeAxisScale(a); offL += a.gutterW }
    var offR = 0.0
    for a in rightAxes { a.axisX = plot.x + plot.width + offR; makeAxisScale(a); offR += a.gutterW }

    var bands: [AWCChartSceneBand] = [], bandLabels: [AWCChartTextItem] = []
    for (ai, a) in axes.enumerated() {
        let built = awcChartBuildAxisBands(a.spec.bands, "y", { a.toPxY(awcChartToNumeric($0, a.spec.scale)) }, plot, theme, "yband-\(ai)")
        bands += built.rects; bandLabels += built.labels
    }
    let onX = awcChartBuildAxisBands(spec.xBands, "x", { plot.x + x.scale(spec.xScale == .category ? awcChartNumberOf($0) : awcChartToNumeric($0, spec.xScale)) }, plot, theme, "xband")
    bands += onX.rects; bandLabels += onX.labels

    var gridlines: [AWCChartSegment] = [], axisLines: [AWCChartSegment] = []
    let primary = axes.first { $0.spec.hidden != true && $0.hasData } ?? axes.first { $0.hasData }
    let xAxisDash = awcChartDashPattern(spec.xDash, 1), xGridDash = awcChartDashPattern(spec.xGridDash, 1)
    if let primary, spec.gridY != false {
        let gridDash = awcChartDashPattern(primary.spec.gridDash, 1)
        for t in primary.tickVals {
            let py = primary.toPxY(t)
            gridlines.append(AWCChartSegment(x1: plot.x, y1: py, x2: plot.x + plot.width, y2: py, color: theme.gridLineColor, width: 1, dash: gridDash))
            if spec.axisTicks == true { axisLines.append(AWCChartSegment(x1: plot.x - AWC_AXIS_TICK_LEN, y1: py, x2: plot.x, y2: py, color: theme.axisLineColor, width: 1, dash: awcChartDashPattern(primary.spec.dash, 1))) }
        }
    }
    for a in axes where a.spec.hidden != true {
        let col = a.tint ?? theme.axisLineColor
        let dash = awcChartDashPattern(a.spec.dash, 1)
        axisLines.append(AWCChartSegment(x1: a.axisX, y1: plot.y, x2: a.axisX, y2: plot.y + plot.height, color: col, width: 1, dash: dash))
        if spec.axisTicks == true && a.spec.hideTicks != true {
            let dir: Double = a.side == "left" ? -1 : 1
            for t in a.tickVals { let py = a.toPxY(t); axisLines.append(AWCChartSegment(x1: a.axisX, y1: py, x2: a.axisX + dir * AWC_AXIS_TICK_LEN, y2: py, color: col, width: 1, dash: dash)) }
        }
    }
    if spec.xHidden != true { axisLines.append(AWCChartSegment(x1: plot.x, y1: plot.y + plot.height, x2: plot.x + plot.width, y2: plot.y + plot.height, color: theme.axisLineColor, width: 1, dash: xAxisDash)) }

    var lines: [AWCChartPolyline] = [], areas: [AWCChartSceneArea] = [], markers: [AWCChartSceneMarker] = [], glyphs: [AWCChartGlyph] = [], hoverPoints: [AWCChartHoverSeries] = []
    for (si, s) in spec.series.enumerated() where !s.hidden {
        let ax = axes[axisIndexOf(s)]
        let toPxY = ax.toPxY
        let zeroInDomain = ax.domain.0 <= 0 && ax.domain.1 >= 0
        let baselineY = toPxY(zeroInDomain ? 0 : ax.domain.0)
        let runs = awcChartSplitRuns(s.data, s.connectNulls)
        var byIndex: [Int: AWCChartHoverPoint] = [:]
        for run in runs where !run.isEmpty {
            let raw = run.map { AWCChartPt(x: toPxX($0.index), y: toPxY($0.value)) }
            for (k, r) in run.enumerated() {
                let hoverSym = s.pointSymbols?[r.index] ?? (s.symbol != nil && s.symbol != "none" && !(s.symbol!.isEmpty) ? s.symbol! : "circle")
                byIndex[r.index] = AWCChartHoverPoint(x: raw[k].x, y: raw[k].y, value: s.data[r.index].raw ?? r.value, low: nil, high: nil, symbol: hoverSym, color: nil)
            }
            let poly = awcChartClampToRect(awcChartInterpolate(awcChartDecimateMinMax(raw, plot.width), s.curve), plot.x, plot.y, plot.width, plot.height)
            lines.append(AWCChartPolyline(points: poly, color: s.color, width: 2.5, dash: awcChartDashPattern(s.dash, 2.5), seriesIndex: si))
            if spec.area && s.fill != false {
                let fo = spec.fillOpacity ?? 0.35
                areas.append(AWCChartSceneArea(points: poly, baselineY: baselineY, colorTop: awcChartHexToRgba(s.color, fo), colorBottom: awcChartHexToRgba(s.color, Swift.max(0.02, fo * 0.06)), basePoints: nil, horizontal: nil, seriesIndex: si))
            }
            let markSet = s.markIndices.map(Set.init)
            for (k, r) in run.enumerated() {
                let override = s.pointSymbols?[r.index]
                let showDefault = markSet != nil ? markSet!.contains(r.index) : s.showMarks
                let sym = override ?? (showDefault ? (s.symbol ?? "circle") : nil)
                guard let sym, !sym.isEmpty, sym != "none" else { continue }
                if awcChartIsShapeSymbol(sym) { markers.append(AWCChartSceneMarker(x: raw[k].x, y: raw[k].y, r: awcChartMarkerRadius(sym, s.markSize), color: s.color, symbol: sym, seriesIndex: si, hollow: nil, fill: nil)) }
                else { glyphs.append(AWCChartGlyph(x: raw[k].x, y: raw[k].y, text: sym, size: AWC_GLYPH_SIZE, label: nil)) }
            }
            if spec.showLabels == true {
                for (k, r) in run.enumerated() {
                    let above = raw[k].y - 9 - theme.labelSize >= plot.y
                    glyphs.append(AWCChartGlyph(x: raw[k].x, y: raw[k].y, text: ax.spec.formatter(s.data[r.index].raw ?? r.value), size: theme.labelSize,
                                                label: AWCChartGlyphLabel(color: theme.textColor, weight: 600, dx: 0, dy: above ? -9 : 9, anchorX: "-50%", anchorY: above ? "-100%" : "0")))
                }
            }
        }
        hoverPoints.append(AWCChartHoverSeries(seriesIndex: si, color: s.color, label: s.label, unanchored: !awcChartHasAnchor(s), byIndex: byIndex, values: s.data, valueFormat: ax.spec.formatter))
    }

    var texts = bandLabels
    if let title = spec.title, !title.isEmpty {
        let tt = awcChartTitlePlacement(spec.titleAlign, plot.x, plot.width)
        texts.append(AWCChartTextItem(x: tt.x, y: legendBandTop + 6, text: title, color: theme.textColor, fontSize: theme.titleSize, fontWeight: 600, align: tt.align, baseline: "top", rotate: nil, key: "title"))
        if let sub = spec.subtitle, !sub.isEmpty { texts.append(AWCChartTextItem(x: tt.x, y: legendBandTop + 6 + theme.titleSize + 4, text: sub, color: theme.textColorMuted, fontSize: theme.labelSize, fontWeight: nil, align: tt.align, baseline: "top", rotate: nil, key: "subtitle")) }
    }
    for (ai, a) in axes.enumerated() where a.spec.hidden != true {
        let labelColor = a.tint ?? theme.textColorMuted
        if a.spec.hideTicks != true {
            for (i, t) in a.tickVals.enumerated() {
                texts.append(AWCChartTextItem(x: a.side == "left" ? a.axisX - 8 : a.axisX + 8, y: a.toPxY(t), text: a.tickLabels[i], color: labelColor, fontSize: theme.labelSize, fontWeight: nil, align: a.side == "left" ? "end" : "start", baseline: "middle", rotate: nil, key: "yt-\(ai)-\(i)"))
            }
        }
        if let l = a.spec.label, !l.isEmpty {
            let outerX = a.side == "left" ? a.axisX - a.gutterW + theme.labelSize : a.axisX + a.gutterW - theme.labelSize
            texts.append(AWCChartTextItem(x: outerX, y: plot.y + plot.height / 2, text: l, color: a.tint ?? theme.textColor, fontSize: theme.labelSize, fontWeight: nil, align: "center", baseline: "top", rotate: -90, key: "yaxis-title-\(ai)"))
        }
    }
    var xPositions: [Double] = []
    for i in 0..<rows { xPositions.append(toPxX(i)) }
    let yb = plot.y + plot.height
    var xAnchors: [(px: Double, text: String, key: String)] = []
    if spec.xScale == .category {
        let step = Swift.max(1, Int((Double(rows) / Double(Swift.max(1, Int((plot.width / 60).rounded(.down))))).rounded(.up)))
        for i in 0..<rows where i % step == 0 { xAnchors.append((xPositions[i], spec.xFormatter(i < spec.xValues.count ? spec.xValues[i] : .number(Double(i))), "xt-\(i)")) }
    } else {
        let xd = awcComputeDomain(xNums, scale: spec.xScale)
        let n = Swift.max(2, Int((plot.width / 90).rounded(.down)))
        let xTicks = spec.xScale == .log ? awcLogTicks(xd.0, xd.1) : spec.xScale == .time ? awcTimeTicks(xd.0, xd.1, n) : awcNiceLinearTicks(xd.0, xd.1, n)
        for tv in xTicks {
            let px = plot.x + x.scale(tv)
            if px < plot.x - 1 || px > plot.x + plot.width + 1 { continue }
            xAnchors.append((px, spec.xFormatter(spec.xScale == .time ? .date(tv) : .number(tv)), "xt-\(awcJSNumberString(tv))"))
        }
    }
    if spec.gridX == true { for a in xAnchors { gridlines.append(AWCChartSegment(x1: a.px, y1: plot.y, x2: a.px, y2: yb, color: theme.gridLineColor, width: 1, dash: xGridDash)) } }
    if spec.xHidden != true && spec.xHideTicks != true {
        for a in xAnchors {
            if spec.axisTicks == true { axisLines.append(AWCChartSegment(x1: a.px, y1: yb, x2: a.px, y2: yb + AWC_AXIS_TICK_LEN, color: theme.axisLineColor, width: 1, dash: xAxisDash)) }
            texts.append(AWCChartTextItem(x: a.px, y: yb + 6, text: a.text, color: theme.textColorMuted, fontSize: theme.labelSize, fontWeight: nil, align: "center", baseline: "top", rotate: nil, key: a.key))
        }
    }
    if let xl = spec.xLabel, !xl.isEmpty { texts.append(AWCChartTextItem(x: plot.x + plot.width / 2, y: height - legendBandBottom - 2, text: xl, color: theme.textColor, fontSize: theme.labelSize, fontWeight: nil, align: "center", baseline: "bottom", rotate: nil, key: "x-axis-title")) }
    for ml in spec.markLines ?? [] {
        let mv = spec.xScale == .category ? awcChartNumberOf(ml.value) : awcChartToNumeric(ml.value, spec.xScale)
        let px = plot.x + x.scale(mv)
        if !px.isFinite || px < plot.x - 1 || px > plot.x + plot.width + 1 { continue }
        gridlines.append(AWCChartSegment(x1: px, y1: plot.y, x2: px, y2: plot.y + plot.height, color: ml.color ?? theme.axisLineColor, width: 1.5, dash: awcChartDashPattern(ml.dash ?? "dashed", 1.5)))
        if let l = ml.label, !l.isEmpty { texts.append(AWCChartTextItem(x: px + 4, y: plot.y + 2, text: l, color: theme.textColorMuted, fontSize: theme.labelSize, fontWeight: nil, align: "start", baseline: "top", rotate: nil, key: "markline-\(awcJSNumberString(awcJSRound(px)))")) }
    }
    let legend: [AWCChartLegendItem] = spec.legend == "none" ? [] : spec.series.enumerated().map { AWCChartLegendItem(label: $1.label, color: $1.color, seriesIndex: $0, hidden: $1.hidden, x: 0, y: 0) }
    var xLabels: [String] = []
    for i in 0..<rows { xLabels.append(spec.xFormatter(i < spec.xValues.count ? spec.xValues[i] : .number(Double(i)))) }
    return AWCChartScene(barBaseline: nil, width: width, height: height, plot: plot, background: theme.background == "transparent" ? nil : theme.background,
                         bands: bands, gridlines: gridlines, axisLines: axisLines, areas: areas, bars: [], slices: [], lines: lines, markers: markers,
                         glyphs: glyphs, endLabels: [], texts: texts, legend: legend, legendPosition: spec.legend,
                         xPositions: xPositions, xValues: spec.xValues, xLabels: xLabels, hoverPoints: hoverPoints)
}
