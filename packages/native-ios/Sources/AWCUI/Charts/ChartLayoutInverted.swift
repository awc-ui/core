import Foundation

// Port of layout.ts `computeInvertedLayout`: the independent axis runs vertically, values horizontally.

func awcChartComputeInvertedLayout(_ spec: AWCChartLineSpec, _ theme: AWCChartEngineTheme, _ width: Double, _ height: Double) -> AWCChartScene {
    let rows = !spec.xValues.isEmpty ? spec.xValues.count : Int(awcMax(0, spec.series.map { Double($0.data.count) }))
    let compact = spec.compact == true
    let category = spec.xScale == .category
    let stackKeys: [String?] = spec.series.map { spec.stack != "none" && $0.range == nil ? "stacked" : "__unstacked__" }
    var bands = awcChartStackSeries(spec.series.map { $0.hidden ? [] : $0.data }, spec.stack, stackKeys)
    for (si, s) in spec.series.enumerated() where s.range != nil && !s.hidden {
        bands[si] = s.range!.map { r in r.map { .band(Swift.min($0.0, $0.1), Swift.max($0.0, $0.1)) } ?? .null }
    }
    var valVals: [Double] = []
    for (si, s) in spec.series.enumerated() where !s.hidden { for b in bands[si] { if let (a, z) = b.band { valVals.append(a); valVals.append(z) } } }
    let valDomain = awcComputeDomain(valVals, min: spec.yMin, max: spec.yMax, scale: spec.yScale, includeZero: false)
    let valTicks = spec.yScale == .log ? awcLogTicks(valDomain.0, valDomain.1) : awcNiceLinearTicks(valDomain.0, valDomain.1, 8)
    let valTickLabels = valTicks.map { (spec.yTickFormatter ?? spec.yFormatter)($0) }
    let xNums = spec.xValues.map { awcChartToNumeric($0, spec.xScale) }
    let mainDomain: AWCChartDomain = category ? (0, Double(Swift.max(1, rows - 1))) : awcComputeDomain(xNums, scale: spec.xScale)
    let mainTickIdx: [Double] = category ? (0..<Swift.max(0, rows)).map(Double.init) : awcNiceLinearTicks(mainDomain.0, mainDomain.1, 6)
    let mainTickLabels = mainTickIdx.map { v -> String in
        if category { let i = Int(v); return spec.xFormatter(i < spec.xValues.count ? spec.xValues[i] : .number(v)) }
        return spec.xFormatter(.number(v))
    }
    let legendActive = (spec.legend?.isEmpty == false) && spec.legend != "none" && spec.series.count > 1
    let legendSide = legendActive && (spec.legend == "left" || spec.legend == "right")
    let legendAtBottom = legendActive && !legendSide && spec.legend!.hasPrefix("bottom")
    let legendTopRow = legendActive && !legendSide && !legendAtBottom
    let legendRows = legendTopRow || legendAtBottom ? awcChartEstimateLegendRows(spec.series.map(\.label), theme.labelSize, width * 0.86) : 1
    let legendBandH = spec.legendExtent != nil && (legendTopRow || legendAtBottom) ? spec.legendExtent! + 8 : Double(legendRows) * (theme.labelSize + 8) + 6
    let legendBandTop = legendTopRow ? legendBandH : 0, legendBandBottom = legendAtBottom ? legendBandH : 0
    let legendSideW = legendSide ? (spec.legendExtent != nil ? spec.legendExtent! + 16 : awcMax(0, spec.series.map { awcChartApproxWidth($0.label, theme.labelSize) }) + 34) : 0
    let titleH = (spec.title?.isEmpty == false) ? theme.titleSize + 10 + ((spec.subtitle?.isEmpty == false) ? theme.labelSize + 4 : 0) : 0
    let maxMainLabelW = spec.xHidden == true || spec.xHideTicks == true ? 0 : awcMax(0, mainTickLabels.map { awcChartApproxWidth($0, theme.labelSize) })
    let valLabelH = spec.yHidden == true || spec.yHideTicks == true ? 0 : theme.labelSize + 8
    let mainAxisTitleW = (spec.xLabel?.isEmpty == false) ? theme.labelSize + 6 : 0
    let valAxisTitleH = (spec.yLabel?.isEmpty == false) ? theme.labelSize + 6 : 0
    let padTop = compact ? 2 : titleH + 8 + legendBandTop
    let padRight = compact ? 2 : 12 + awcChartApproxWidth(valTickLabels.last ?? "", theme.labelSize) / 2 + (spec.legend == "right" ? legendSideW : 0)
    let padBottom = compact ? 2 : valLabelH + valAxisTitleH + 6 + legendBandBottom
    let padLeft = compact ? 2 : maxMainLabelW + 10 + mainAxisTitleW + (spec.legend == "left" ? legendSideW : 0)
    let plot = AWCChartRect(x: padLeft, y: padTop, width: Swift.max(1, width - padLeft - padRight), height: Swift.max(1, height - padTop - padBottom))
    let valScale = spec.yScale == .log ? awcMakeLogScale(valDomain, plot.width) : awcMakeLinearScale(valDomain, plot.width, spec.yScale)
    let mainScale = category ? awcMakeCategoryScale(rows, plot.height, true) : spec.xScale == .log ? awcMakeLogScale(mainDomain, plot.height) : awcMakeLinearScale(mainDomain, plot.height, spec.xScale)
    func toPxX(_ v: Double) -> Double { plot.x + valScale.scale(v) }
    func toPxYval(_ c: Double) -> Double { plot.y + plot.height - mainScale.scale(c) }
    func toPxYidx(_ i: Int) -> Double { toPxYval(category ? Double(i) : (i >= 0 && i < xNums.count ? xNums[i] : 0)) }

    var gridlines: [AWCChartSegment] = [], axisLines: [AWCChartSegment] = []
    let yb = plot.y + plot.height
    let yAxisDash = awcChartDashPattern(spec.yDash, 1), yGridDash = awcChartDashPattern(spec.yGridDash, 1)
    let xAxisDash = awcChartDashPattern(spec.xDash, 1), xGridDash = awcChartDashPattern(spec.xGridDash, 1)
    if spec.yHidden != true && !compact {
        for t in valTicks {
            let px = toPxX(t)
            if spec.gridY != false { gridlines.append(AWCChartSegment(x1: px, y1: plot.y, x2: px, y2: yb, color: theme.gridLineColor, width: 1, dash: yGridDash)) }
            if spec.axisTicks == true { axisLines.append(AWCChartSegment(x1: px, y1: yb, x2: px, y2: yb + AWC_AXIS_TICK_LEN, color: theme.axisLineColor, width: 1, dash: yAxisDash)) }
        }
        axisLines.append(AWCChartSegment(x1: plot.x, y1: yb, x2: plot.x + plot.width, y2: yb, color: theme.axisLineColor, width: 1, dash: yAxisDash))
    }
    if spec.xHidden != true && !compact {
        for t in mainTickIdx {
            let py = toPxYval(t)
            if spec.gridX == true { gridlines.append(AWCChartSegment(x1: plot.x, y1: py, x2: plot.x + plot.width, y2: py, color: theme.gridLineColor, width: 1, dash: xGridDash)) }
            if spec.axisTicks == true { axisLines.append(AWCChartSegment(x1: plot.x - AWC_AXIS_TICK_LEN, y1: py, x2: plot.x, y2: py, color: theme.axisLineColor, width: 1, dash: xAxisDash)) }
        }
        axisLines.append(AWCChartSegment(x1: plot.x, y1: plot.y, x2: plot.x, y2: plot.y + plot.height, color: theme.axisLineColor, width: 1, dash: xAxisDash))
    }
    var lines: [AWCChartPolyline] = [], areas: [AWCChartSceneArea] = [], markers: [AWCChartSceneMarker] = [], glyphs: [AWCChartGlyph] = [], hoverPoints: [AWCChartHoverSeries] = []
    let baselineX = toPxX(Swift.max(valDomain.0, Swift.min(valDomain.1, 0)))
    for (si, s) in spec.series.enumerated() where !s.hidden {
        var byIndex: [Int: AWCChartHoverPoint] = [:]
        let tops: [AWCChartCell] = bands[si].map { b in switch b { case .hole: return .hole; case .null: return .null; case .band(_, let hi): return .num(hi) } }
        for run in awcChartSplitRuns(tops, s.connectNulls) where !run.isEmpty {
            let raw = run.map { AWCChartPt(x: toPxX($0.value), y: toPxYidx($0.index)) }
            for (k, r) in run.enumerated() {
                let hoverSym = s.pointSymbols?[r.index] ?? (s.symbol != nil && s.symbol != "none" && !(s.symbol!.isEmpty) ? s.symbol! : "circle")
                let dataV = r.index < s.data.count ? s.data[r.index].raw : nil
                byIndex[r.index] = AWCChartHoverPoint(x: raw[k].x, y: raw[k].y, value: dataV ?? r.value, low: nil, high: nil, symbol: hoverSym, color: nil)
            }
            let poly = awcChartClampToRect(awcChartInterpolate(awcChartDecimateMinMax(raw, plot.width), s.curve), plot.x, plot.y, plot.width, plot.height)
            if s.range == nil && s.stroke != false { lines.append(AWCChartPolyline(points: poly, color: s.color, width: 2.5, dash: awcChartDashPattern(s.dash, 2.5), seriesIndex: si)) }
            if spec.area && s.fill != false {
                let fo = spec.fillOpacity ?? 0.35
                let banded = spec.stack != "none" || s.range != nil
                let basePoints = banded
                    ? awcChartClampToRect(awcChartInterpolate(run.map { AWCChartPt(x: toPxX(bands[si][$0.index].band?.0 ?? .nan), y: toPxYidx($0.index)) }, s.curve), plot.x, plot.y, plot.width, plot.height)
                    : poly.map { AWCChartPt(x: baselineX, y: $0.y) }
                areas.append(AWCChartSceneArea(points: poly, baselineY: baselineX, colorTop: awcChartHexToRgba(s.color, fo), colorBottom: banded ? awcChartHexToRgba(s.color, fo) : awcChartHexToRgba(s.color, Swift.max(0.02, fo * 0.06)), basePoints: basePoints, horizontal: true, seriesIndex: si))
            }
            let markSet = s.markIndices.map(Set.init)
            for (k, r) in run.enumerated() {
                let override = s.pointSymbols?[r.index]
                let sym = override ?? ((markSet != nil ? markSet!.contains(r.index) : s.showMarks) ? (s.symbol ?? "circle") : nil)
                guard let sym, !sym.isEmpty, sym != "none" else { continue }
                if awcChartIsShapeSymbol(sym) { markers.append(AWCChartSceneMarker(x: raw[k].x, y: raw[k].y, r: awcChartMarkerRadius(sym, s.markSize), color: s.color, symbol: sym, seriesIndex: si, hollow: nil, fill: nil)) }
                else { glyphs.append(AWCChartGlyph(x: raw[k].x, y: raw[k].y, text: sym, size: AWC_GLYPH_SIZE, label: nil)) }
            }
            if spec.showLabels == true && !compact {
                for (k, r) in run.enumerated() {
                    let dataV = r.index < s.data.count ? s.data[r.index].raw : nil
                    glyphs.append(AWCChartGlyph(x: raw[k].x, y: raw[k].y, text: spec.yFormatter(dataV ?? r.value), size: theme.labelSize, label: AWCChartGlyphLabel(color: theme.textColor, weight: 600, dx: 9, dy: 0, anchorX: "0", anchorY: "-50%")))
                }
            }
        }
        hoverPoints.append(AWCChartHoverSeries(seriesIndex: si, color: s.color, label: s.label, unanchored: !awcChartHasAnchor(s), byIndex: byIndex, values: s.data, valueFormat: nil))
    }
    var texts: [AWCChartTextItem] = []
    if let title = spec.title, !title.isEmpty, !compact {
        let tt = awcChartTitlePlacement(spec.titleAlign, plot.x, plot.width)
        texts.append(AWCChartTextItem(x: tt.x, y: legendBandTop + 6, text: title, color: theme.textColor, fontSize: theme.titleSize, fontWeight: 600, align: tt.align, baseline: "top", rotate: nil, key: "title"))
        if let sub = spec.subtitle, !sub.isEmpty { texts.append(AWCChartTextItem(x: tt.x, y: legendBandTop + 6 + theme.titleSize + 4, text: sub, color: theme.textColorMuted, fontSize: theme.labelSize, fontWeight: nil, align: tt.align, baseline: "top", rotate: nil, key: "subtitle")) }
    }
    if spec.xHidden != true && spec.xHideTicks != true && !compact {
        for (i, t) in mainTickIdx.enumerated() { texts.append(AWCChartTextItem(x: plot.x - 8, y: toPxYval(t), text: mainTickLabels[i], color: theme.textColorMuted, fontSize: theme.labelSize, fontWeight: nil, align: "end", baseline: "middle", rotate: nil, key: "mt-\(i)")) }
    }
    if spec.yHidden != true && spec.yHideTicks != true && !compact {
        for (i, t) in valTicks.enumerated() { texts.append(AWCChartTextItem(x: toPxX(t), y: yb + 6, text: valTickLabels[i], color: theme.textColorMuted, fontSize: theme.labelSize, fontWeight: nil, align: "center", baseline: "top", rotate: nil, key: "vt-\(i)")) }
    }
    if let xl = spec.xLabel, !xl.isEmpty, !compact { texts.append(AWCChartTextItem(x: 4, y: plot.y + plot.height / 2, text: xl, color: theme.textColor, fontSize: theme.labelSize, fontWeight: nil, align: "center", baseline: "top", rotate: -90, key: "x-axis-title")) }
    if let yl = spec.yLabel, !yl.isEmpty, !compact { texts.append(AWCChartTextItem(x: plot.x + plot.width / 2, y: height - legendBandBottom - 2, text: yl, color: theme.textColor, fontSize: theme.labelSize, fontWeight: nil, align: "center", baseline: "bottom", rotate: nil, key: "y-axis-title")) }
    let legend: [AWCChartLegendItem] = spec.legend == "none" || compact ? [] : spec.series.enumerated().map { AWCChartLegendItem(label: $1.label, color: $1.color, seriesIndex: $0, hidden: $1.hidden, x: 0, y: 0) }
    var xPositions: [Double] = [], xLabels: [String] = []
    for i in 0..<rows { xPositions.append(toPxYidx(i)); xLabels.append(spec.xFormatter(i < spec.xValues.count ? spec.xValues[i] : .number(Double(i)))) }
    var scene = AWCChartScene(barBaseline: nil, width: width, height: height, plot: plot, background: theme.background == "transparent" ? nil : theme.background,
                              bands: nil, gridlines: gridlines, axisLines: axisLines, areas: areas, bars: [], slices: [], lines: lines, markers: markers,
                              glyphs: glyphs, endLabels: nil, texts: texts, legend: legend, legendPosition: spec.legend,
                              xPositions: xPositions, xValues: spec.xValues, xLabels: xLabels, hoverPoints: hoverPoints)
    scene.inverted = true
    return scene
}
