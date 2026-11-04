import Foundation

// Port of engine/bar-layout.ts: bar / column / polar spec → RenderScene.

struct AWCChartBarSeriesSpec {
    var label: String; var color: String; var data: [AWCChartCell]; var hidden: Bool
    var range: [(Double, Double)?]? = nil; var pointWidths: [Int: Double]? = nil; var axisIndex: Int? = nil
    var overlay: Bool? = nil; var widthRatio: Double? = nil; var stack: String? = nil; var pointColors: [Int: String]? = nil
}

struct AWCChartValueAxis2 { var min: Double?; var max: Double?; var label: String?; var formatter: ((Double) -> String)?; var hidden: Bool? }

struct AWCChartBarSpec {
    var series: [AWCChartBarSeriesSpec]
    var title: String? = nil, titleAlign: String? = nil
    var categories: [AWCChartAxisValue]
    var categoryFormatter: (AWCChartAxisValue) -> String
    var categoryLabel: String? = nil, categoryHidden: Bool? = nil, categoryHideTicks: Bool? = nil, categoryDash: String? = nil
    var categoryLabelRotation: Double? = nil, categoryLabelsMirrored: Bool? = nil
    var valueScale: AWCChartScaleType = .value
    var valueBreaks: AWCChartAxisBreaks? = nil
    var valueMin: Double? = nil, valueMax: Double? = nil
    var valueFormatter: (Double) -> String
    var valueTickFormatter: ((Double) -> String)? = nil
    var valueLabel: String? = nil
    var valueAxis2: AWCChartValueAxis2? = nil
    var valueHidden: Bool? = nil, valueHideTicks: Bool? = nil
    var categoryAxisLine: Bool? = nil, valueAxisLine: Bool? = nil, valueDash: String? = nil, valueGridDash: String? = nil
    var stack: String
    var horizontal: Bool
    var categoryGapRatio: Double
    var barGapRatio: Double
    var barWidth: Double? = nil
    var cornerRadius: Double
    var polar: Bool? = nil, polarHole: Double? = nil, polarSweep: Double? = nil, chevron: Bool? = nil
    var showLabels: Bool
    var showTotals: Bool? = nil
    var subtitle: String? = nil
    var legend: String? = nil
    var legendExtent: Double? = nil
    var compact: Bool? = nil, axisTicks: Bool? = nil, animation: String? = nil, animationDuration: Double? = nil
}

let AWC_CHEVRON_MAX_TIP = 32.0
func awcChartChevronTipDepth(_ thickness: Double) -> Double { Swift.min(thickness * 0.3, AWC_CHEVRON_MAX_TIP) }

private func awcVisibleValueTicks(_ values: [Double], _ labels: [String], _ toPx: (Double) -> Double, _ measure: (String) -> Double) -> [Int] {
    struct T { let value: Double, index: Int, x: Double, width: Double }
    let ticks = values.enumerated().map { T(value: $1, index: $0, x: toPx($1), width: measure(labels[$0])) }.awcStableSorted { $0.x < $1.x }
    if ticks.count < 2 { return ticks.map(\.index) }
    func fits(_ a: T, _ b: T) -> Bool { b.x - a.x >= (a.width + b.width) / 2 + 8 }
    let first = ticks[0], last = ticks[ticks.count - 1]
    if !fits(first, last) { return [(ticks.first { $0.value == 0 } ?? first).index] }
    var visible = [first]
    for t in ticks[1..<(ticks.count - 1)] where fits(visible[visible.count - 1], t) && fits(t, last) { visible.append(t) }
    visible.append(last)
    return visible.map(\.index)
}

private func awcAlignZeroAxes(_ a: AWCChartDomain, _ b: AWCChartDomain) -> (AWCChartDomain, AWCChartDomain) {
    let topA = a.1, topB = b.1
    if !(topA > 0) || !(topB > 0) { return (a, b) }
    let rA = a.0 < 0 ? -a.0 / topA : 0, rB = b.0 < 0 ? -b.0 / topB : 0
    let share = Swift.max(rA, rB)
    if share <= 0 { return (a, b) }
    return ((-share * topA, topA), (-share * topB, topB))
}

private func awcEllipsize(_ text: String, _ maxW: Double, _ fontSize: Double) -> String {
    if maxW <= 0 || awcChartApproxWidth(text, fontSize) <= maxW { return text }
    let n = Int((maxW / (fontSize * 0.58)).rounded(.down)) - 1
    guard n >= 1 else { return "" }
    let u = Array(text.utf16)
    return (String(utf16CodeUnits: Array(u.prefix(n)), count: Swift.min(n, u.count))) + "…"
}

func awcChartComputeBarLayout(_ spec: AWCChartBarSpec, _ theme: AWCChartEngineTheme, _ width: Double, _ height: Double, measureLabel: ((String) -> Double)? = nil) -> AWCChartScene {
    let measure = measureLabel ?? { awcChartApproxWidth($0, theme.labelSize) }
    let horizontal = spec.horizontal
    let C = !spec.categories.isEmpty ? spec.categories.count : Int(awcMax(0, spec.series.map { Double($0.range?.count ?? $0.data.count) }))
    let stacked = spec.stack != "none"
    let stackKeys: [String] = spec.series.map { stacked && $0.range == nil ? (($0.stack?.isEmpty == false) ? $0.stack! : "stacked") : "__unstacked__" }
    var bands = awcChartStackSeries(spec.series.map { $0.hidden || $0.range != nil ? [] : $0.data }, spec.stack, stackKeys)
    for (si, s) in spec.series.enumerated() where s.range != nil && !s.hidden { bands[si] = s.range!.map { d in d.map { .band(Swift.min($0.0, $0.1), Swift.max($0.0, $0.1)) } ?? .null } }
    var vVals: [Double] = []
    for (si, s) in spec.series.enumerated() where !s.hidden { for b in bands[si] { if let (a, z) = b.band { vVals.append(a); vVals.append(z) } } }
    func onAxis2(_ si: Int) -> Bool { (spec.series[si].axisIndex ?? 0) == 1 }
    let hasAxis2 = spec.valueAxis2 != nil && spec.series.indices.contains { !spec.series[$0].hidden && onAxis2($0) }
    var vVals2: [Double] = []
    if hasAxis2 {
        vVals.removeAll()
        for (si, s) in spec.series.enumerated() where !s.hidden { for b in bands[si] { if let (a, z) = b.band { if onAxis2(si) { vVals2 += [a, z] } else { vVals += [a, z] } } } }
    }
    var vDomain = awcComputeDomain(vVals, min: spec.valueMin, max: spec.valueMax, scale: spec.valueScale, includeZero: true)
    var vDomain2 = hasAxis2 ? awcComputeDomain(vVals2, min: spec.valueAxis2!.min, max: spec.valueAxis2!.max, scale: spec.valueScale, includeZero: true) : vDomain
    if hasAxis2 && spec.valueScale == .value && spec.valueMin == nil && spec.valueMax == nil && spec.valueAxis2!.min == nil && spec.valueAxis2!.max == nil {
        (vDomain, vDomain2) = awcAlignZeroAxes(vDomain, vDomain2)
    }
    let vFound = awcResolveAxisBreaks(spec.valueBreaks, vVals, spec.valueScale)
    let vBreakRanges = awcOpenTopSection(awcNormalizeBreaks(vFound.ranges, vDomain), vDomain, spec.valueScale)
    let vTickVals = awcSectionedTicks(vDomain, vBreakRanges, spec.valueScale, 6).filter { !awcInBreak(vBreakRanges, $0) }
    let vTickLabels = vTickVals.map { (spec.valueTickFormatter ?? spec.valueFormatter)($0) }
    let v2Fmt = spec.valueAxis2?.formatter ?? spec.valueTickFormatter ?? spec.valueFormatter
    let v2TickVals = hasAxis2 && spec.valueAxis2!.hidden != true ? awcSectionedTicks(vDomain2, [], spec.valueScale, 6) : []
    let v2TickLabels = v2TickVals.map { v2Fmt($0) }
    let maxV2LabelW = awcMax(0, v2TickLabels.map { awcChartApproxWidth($0, theme.labelSize) })
    let catLabels = (0..<Swift.max(0, C)).map { spec.categoryFormatter($0 < spec.categories.count ? spec.categories[$0] : .number(Double($0))) }
    if spec.polar == true { return awcChartRadialScene(spec, theme, width, height, bands, vDomain, catLabels, C, stacked, stackKeys) }

    let subtitleH = (spec.subtitle?.isEmpty == false) ? theme.labelSize + 4 : 0
    let titleH = (spec.title?.isEmpty == false) ? theme.titleSize + 10 + subtitleH : 0
    let maxVLabelW = spec.valueHidden == true || spec.valueHideTicks == true ? 0 : awcMax(0, vTickLabels.map { awcChartApproxWidth($0, theme.labelSize) })
    let maxCatLabelW = spec.categoryHidden == true || spec.categoryHideTicks == true ? 0 : awcMax(0, catLabels.map { awcChartApproxWidth($0, theme.labelSize) })
    let maxDataLabelW: Double = spec.showLabels ? awcMax(0, spec.series.flatMap { sr -> [Double] in
        if let range = sr.range { return range.flatMap { d -> [Double] in d.map { [awcChartApproxWidth(spec.valueFormatter($0.0), theme.labelSize), awcChartApproxWidth(spec.valueFormatter($0.1), theme.labelSize)] } ?? [] } }
        return sr.data.map { v in if case .num(let n) = v { return awcChartApproxWidth(spec.valueFormatter(n), theme.labelSize) }; return 0 }
    }) : 0
    let axisTitleV = (spec.valueLabel?.isEmpty == false) ? theme.labelSize + 6 : 0
    let axisTitleC = (spec.categoryLabel?.isEmpty == false) ? theme.labelSize + 6 : 0
    let labelRowH = theme.labelSize + 8
    let catRot = !horizontal ? (spec.categoryLabelRotation ?? 0) : 0
    let catRotRad = (abs(catRot) * Double.pi) / 180
    let catLabelRowH = catRot != 0 ? maxCatLabelW * sin(catRotRad) + theme.labelSize * cos(catRotRad) + 8 : labelRowH
    let legendActive = (spec.legend?.isEmpty == false) && spec.legend != "none" && spec.series.count > 1
    let legendSide = legendActive && (spec.legend == "left" || spec.legend == "right")
    let legendAtBottom = legendActive && !legendSide && spec.legend!.hasPrefix("bottom")
    let legendTopRow = legendActive && !legendSide && !legendAtBottom
    let legendRows = legendTopRow || legendAtBottom ? awcChartEstimateLegendRows(spec.series.map(\.label), theme.labelSize, width * 0.86) : 1
    let legendBandH = spec.legendExtent != nil && (legendTopRow || legendAtBottom) ? spec.legendExtent! + 8 : Double(legendRows) * (theme.labelSize + 8) + 6
    let legendBandTop = legendTopRow ? legendBandH : 0, legendBandBottom = legendAtBottom ? legendBandH : 0
    let legendSideW = legendSide ? (spec.legendExtent != nil ? spec.legendExtent! + 16 : awcMax(0, spec.series.map { awcChartApproxWidth($0.label, theme.labelSize) }) + 34) : 0
    let legendLeftW = spec.legend == "left" ? legendSideW : 0, legendRightW = spec.legend == "right" ? legendSideW : 0
    let labelsAtLowEnd = (spec.showLabels || spec.showTotals == true) && spec.series.contains { sr in !sr.hidden && (sr.range != nil || sr.data.contains { if case .num(let v) = $0 { return v < 0 }; return false }) }
    let mirrorCats = spec.categoryLabelsMirrored == true && horizontal && spec.categoryHidden != true && spec.categoryHideTicks != true
    let compact = spec.compact == true
    let lowEndRoom = labelsAtLowEnd ? (horizontal ? maxDataLabelW + 8 : theme.labelSize + 4) : 0
    var padTop: Double, padRight: Double, padBottom: Double, padLeft: Double
    if compact { padTop = 2; padRight = 2; padBottom = 2; padLeft = 2 }
    else if horizontal {
        padTop = titleH + 8 + legendBandTop
        padLeft = maxCatLabelW + 12 + axisTitleC + legendLeftW + (labelsAtLowEnd ? maxDataLabelW + 8 : 0)
        padBottom = (spec.valueHidden == true || spec.valueHideTicks == true ? 0 : labelRowH) + axisTitleV + 6 + legendBandBottom
        padRight = 12 + (spec.showLabels ? maxDataLabelW + 8 : 0) + legendRightW + (mirrorCats ? maxCatLabelW + 12 : 0)
        let tickOverhang = spec.valueHidden == true || spec.valueHideTicks == true ? 0 : awcMax(0, vTickLabels.map(measure)) / 2 + 4
        padLeft = Swift.max(padLeft, legendLeftW + tickOverhang)
        padRight = Swift.max(padRight, legendRightW + tickOverhang)
    } else {
        padTop = titleH + 8 + legendBandTop + (spec.showLabels ? theme.labelSize + 4 : 0)
        padRight = 12 + legendRightW + (spec.showLabels ? maxDataLabelW / 2 : 0) + (hasAxis2 ? maxV2LabelW + 10 + ((spec.valueAxis2!.label?.isEmpty == false) ? theme.labelSize + 6 : 0) : 0)
        padLeft = maxVLabelW + 10 + axisTitleV + legendLeftW
        padBottom = (spec.categoryHidden == true || spec.categoryHideTicks == true ? 0 : catLabelRowH) + axisTitleC + 6 + legendBandBottom + (labelsAtLowEnd ? theme.labelSize + 4 : 0)
    }
    let plot = AWCChartRect(x: padLeft, y: padTop, width: Swift.max(1, width - padLeft - padRight), height: Swift.max(1, height - padTop - padBottom))
    let crossLen = horizontal ? plot.width : plot.height
    let vScale = awcMakeBrokenScale(vDomain, crossLen, spec.valueScale, vBreakRanges, vFound.sizing)
    let baselineVal = Swift.min(vDomain.1, Swift.max(vDomain.0, 0))
    let vScale2 = hasAxis2 ? awcMakeBrokenScale(vDomain2, crossLen, spec.valueScale, [], vFound.sizing) : vScale
    func valPx(_ v: Double) -> Double { horizontal ? plot.x + vScale.scale(v) : plot.y + plot.height - vScale.scale(v) }
    func valPx2(_ v: Double) -> Double { horizontal ? plot.x + vScale2.scale(v) : plot.y + plot.height - vScale2.scale(v) }
    func valPxFor(_ si: Int, _ v: Double) -> Double { hasAxis2 && onAxis2(si) ? valPx2(v) : valPx(v) }
    let basePx = valPx(baselineVal)
    let valueTicks = horizontal && spec.valueHideTicks != true && spec.valueHidden != true ? awcVisibleValueTicks(vTickVals, vTickLabels, valPx, measure) : Array(vTickVals.indices)
    let breakStrips: [(lo: Double, hi: Double)] = vScale.breaks.map { b in horizontal ? (plot.x + b.px, plot.x + b.px + b.gap) : (plot.y + plot.height - b.px - b.gap, plot.y + plot.height - b.px) }
    func splitBar(_ bar: AWCChartSceneBar) -> [AWCChartSceneBar] {
        if breakStrips.isEmpty { return [bar] }
        let lo = horizontal ? bar.x : bar.y, hi = lo + (horizontal ? bar.w : bar.h)
        var pieces: [(Double, Double)] = [(lo, hi)]
        for strip in breakStrips {
            var next: [(Double, Double)] = []
            for p in pieces {
                if strip.hi <= p.0 || strip.lo >= p.1 { next.append(p); continue }
                if strip.lo > p.0 { next.append((p.0, strip.lo)) }
                if strip.hi < p.1 { next.append((strip.hi, p.1)) }
            }
            pieces = next
        }
        if pieces.count == 1 && pieces[0].0 == lo && pieces[0].1 == hi { return [bar] }
        let kept = pieces.filter { $0.1 - $0.0 > 0.5 }
        return kept.enumerated().map { idx, p in
            var b = bar
            b.radius = idx == (horizontal ? kept.count - 1 : 0) ? bar.radius : [0, 0, 0, 0]
            if horizontal { b.x = p.0; b.w = p.1 - p.0 } else { b.y = p.0; b.h = p.1 - p.0 }
            return b
        }
    }
    let mainStart = horizontal ? plot.y : plot.x, mainLen = horizontal ? plot.height : plot.width
    let widthWeights = spec.series.first { !$0.hidden && $0.pointWidths != nil }?.pointWidths
    func weightAt(_ i: Int) -> Double { if let w = widthWeights?[i], w.isFinite, w > 0 { return w }; return 1 }
    var weightSum = 0.0
    var bandStarts = [Double](repeating: 0, count: Swift.max(0, C))
    for i in 0..<Swift.max(0, C) { bandStarts[i] = weightSum; weightSum += weightAt(i) }
    if weightSum <= 0 { weightSum = Double(Swift.max(1, C)) }
    func sizeAt(_ i: Int) -> Double { C > 0 ? (mainLen * weightAt(i)) / weightSum : mainLen }
    func startAt(_ i: Int) -> Double { mainStart + (mainLen * bandStarts[i]) / weightSum }
    func bandCenter(_ i: Int) -> Double { startAt(i) + sizeAt(i) / 2 }
    func groupInnerAt(_ i: Int) -> Double { sizeAt(i) * (1 - spec.categoryGapRatio) }
    let visibleIdx = spec.series.indices.filter { !spec.series[$0].hidden && spec.series[$0].overlay != true }
    var groupNames: [String] = []
    for i in visibleIdx where !groupNames.contains(stackKeys[i]) { groupNames.append(stackKeys[i]) }
    let groupCount = Double(stacked ? Swift.max(1, groupNames.count) : Swift.max(1, visibleIdx.count))
    func barWAt(_ i: Int) -> Double { groupInnerAt(i) / (groupCount + (groupCount - 1) * spec.barGapRatio) }
    var topSeriesFor: [String: Int] = [:], botSeriesFor: [String: Int] = [:]
    if stacked {
        for r in 0..<Swift.max(0, C) {
            var topV: [String: Double] = [:], botV: [String: Double] = [:]
            for (si, s) in spec.series.enumerated() where !s.hidden {
                guard r < bands[si].count, let b = bands[si][r].band else { continue }
                let k = "\(stackKeys[si])|\(r)"
                if b.1 > (topV[k] ?? -.infinity) { topV[k] = b.1; topSeriesFor[k] = si }
                if b.0 < (botV[k] ?? .infinity) { botV[k] = b.0; botSeriesFor[k] = si }
            }
        }
    }
    var bars: [AWCChartSceneBar] = [], hoverPoints: [AWCChartHoverSeries] = [], texts: [AWCChartTextItem] = [], barLabels: [AWCChartBarLabel] = []
    let r = spec.cornerRadius
    for (si, s) in spec.series.enumerated() where !s.hidden {
        let groupPos = Double(stacked ? Swift.max(0, groupNames.firstIndex(of: stackKeys[si]) ?? -1) : Swift.max(0, visibleIdx.firstIndex(of: si) ?? -1))
        var byIndex: [Int: AWCChartHoverPoint] = [:]
        for i in 0..<Swift.max(0, C) {
            guard i < bands[si].count, let band = bands[si][i].band else { continue }
            let isRange = s.range != nil
            let raw: AWCChartCell? = isRange ? nil : (i < s.data.count ? s.data[i] : .hole)
            let rawNum: Double = { if case .num(let n)? = raw { return n }; return band.1 }()
            let p0 = valPxFor(si, band.0), p1 = valPxFor(si, band.1)
            let autoW = s.overlay == true ? sizeAt(i) * (s.widthRatio ?? 0.45) : barWAt(i)
            let barGap = autoW * spec.barGapRatio
            let barW = spec.barWidth != nil && s.overlay != true ? Swift.min(Swift.max(1, spec.barWidth!), autoW) : autoW
            let slotStart = s.overlay == true ? bandCenter(i) - autoW / 2 : bandCenter(i) - groupInnerAt(i) / 2 + groupPos * (autoW + barGap)
            let barStart = slotStart + (autoW - barW) / 2
            let positive = rawNum >= 0
            let stackCell = "\(stackKeys[si])|\(i)"
            let atBaseline = positive ? band.0 == 0 : band.1 == 0
            let isTop = isRange || !stacked || (positive ? topSeriesFor[stackCell] == si : botSeriesFor[stackCell] == si)
            let chev = spec.chevron == true
            let chevInset = chev ? Swift.min(barW * 0.03, 5, abs(p1 - p0) * 0.35) : 0
            let chevLead = chev ? awcChartChevronTipDepth(barW) - chevInset / 2 : 0
            let color = s.pointColors?[i] ?? s.color
            var bar: AWCChartSceneBar
            if horizontal {
                let radius: [Double] = isRange ? [r, r, r, r] : isTop ? (positive ? [0, r, r, 0] : [r, 0, 0, r]) : [0, 0, 0, 0]
                bar = AWCChartSceneBar(x: Swift.min(p0, p1) + chevInset / 2, y: barStart, w: abs(p1 - p0) - chevInset, h: barW, color: color, radius: radius, seriesIndex: si, dataIndex: i, horizontal: true, arrow: chev ? (positive ? 1 : -1) : nil, notch: chev ? !atBaseline : nil)
                byIndex[i] = AWCChartHoverPoint(x: positive ? Swift.max(p0, p1) + chevLead : Swift.min(p0, p1) - chevLead, y: barStart + barW / 2, value: rawNum, low: isRange ? band.0 : nil, high: isRange ? band.1 : nil, symbol: nil, color: color)
            } else {
                let radius: [Double] = isRange ? [r, r, r, r] : isTop ? (positive ? [r, r, 0, 0] : [0, 0, r, r]) : [0, 0, 0, 0]
                bar = AWCChartSceneBar(x: barStart, y: Swift.min(p0, p1) + chevInset / 2, w: barW, h: abs(p1 - p0) - chevInset, color: color, radius: radius, seriesIndex: si, dataIndex: i, horizontal: false, arrow: chev ? (positive ? 1 : -1) : nil, notch: chev ? !atBaseline : nil)
                byIndex[i] = AWCChartHoverPoint(x: barStart + barW / 2, y: positive ? Swift.min(p0, p1) - chevLead : Swift.max(p0, p1) + chevLead, value: rawNum, low: isRange ? band.0 : nil, high: isRange ? band.1 : nil, symbol: nil, color: color)
            }
            bars += splitBar(bar)
            if spec.showLabels && isRange {
                barLabels.append(AWCChartBarLabel(seriesIndex: si, dataIndex: i, text: spec.valueFormatter(band.0), color: theme.textColor, size: theme.labelSize, fontWeight: nil, inside: nil, atLowEnd: true))
                barLabels.append(AWCChartBarLabel(seriesIndex: si, dataIndex: i, text: spec.valueFormatter(band.1), color: theme.textColor, size: theme.labelSize, fontWeight: nil, inside: nil, atLowEnd: false))
            } else if spec.showLabels && stacked, case .num(let rv)? = raw {
                let shown = spec.stack == "percentage" ? abs(band.1 - band.0) * (rv < 0 ? -1 : 1) : rv
                let txt = spec.valueFormatter(shown)
                let fits = horizontal ? bar.w > awcChartApproxWidth(txt, theme.labelSize) + 8 && bar.h > theme.labelSize : bar.h > theme.labelSize + 6 && bar.w > awcChartApproxWidth(txt, theme.labelSize) + 4
                if fits { barLabels.append(AWCChartBarLabel(seriesIndex: si, dataIndex: i, text: txt, color: awcChartOnColor(bar.color), size: theme.labelSize, fontWeight: 600, inside: true, atLowEnd: nil)) }
            } else if spec.showLabels, case .num(let rv)? = raw {
                barLabels.append(AWCChartBarLabel(seriesIndex: si, dataIndex: i, text: spec.valueFormatter(rv), color: theme.textColor, size: theme.labelSize, fontWeight: nil, inside: nil, atLowEnd: !positive))
            }
        }
        hoverPoints.append(AWCChartHoverSeries(seriesIndex: si, color: s.color, label: s.label, unanchored: nil, byIndex: byIndex,
                                               values: s.range != nil ? bands[si].map { $0.band.map { .num($0.1) } ?? .null } : s.data, valueFormat: nil))
    }
    if spec.showTotals == true && stacked && spec.stack != "percentage" {
        for i in 0..<Swift.max(0, C) {
            for g in groupNames {
                var top = -Double.infinity, bottom = Double.infinity, sum = 0.0, any = false
                for (si, s) in spec.series.enumerated() where !s.hidden && stackKeys[si] == g {
                    guard i < bands[si].count, let b = bands[si][i].band else { continue }
                    any = true; top = Swift.max(top, b.1); bottom = Swift.min(bottom, b.0)
                    if i < s.data.count, case .num(let v) = s.data[i] { sum += v }
                }
                if !any { continue }
                let positive = top > 0 || bottom >= 0
                guard let outerSeg = positive ? topSeriesFor["\(g)|\(i)"] : botSeriesFor["\(g)|\(i)"] else { continue }
                barLabels.append(AWCChartBarLabel(seriesIndex: outerSeg, dataIndex: i, text: spec.valueFormatter(sum), color: theme.textColor, size: theme.labelSize, fontWeight: 600, inside: nil, atLowEnd: !positive))
            }
        }
    }
    var gridlines: [AWCChartSegment] = [], axisLines: [AWCChartSegment] = []
    let TICK = 5.0
    let yb = plot.y + plot.height
    let valueDash = awcChartDashPattern(spec.valueDash), gridDash = awcChartDashPattern(spec.valueGridDash), categoryDash = awcChartDashPattern(spec.categoryDash)
    if spec.valueHidden != true && !compact {
        for index in valueTicks {
            let pv = valPx(vTickVals[index])
            if horizontal {
                gridlines.append(AWCChartSegment(x1: pv, y1: plot.y, x2: pv, y2: yb, color: theme.gridLineColor, width: 1, dash: gridDash))
                if spec.axisTicks == true { axisLines.append(AWCChartSegment(x1: pv, y1: yb, x2: pv, y2: yb + TICK, color: theme.axisLineColor, width: 1, dash: valueDash)) }
            } else {
                gridlines.append(AWCChartSegment(x1: plot.x, y1: pv, x2: plot.x + plot.width, y2: pv, color: theme.gridLineColor, width: 1, dash: gridDash))
                if spec.axisTicks == true { axisLines.append(AWCChartSegment(x1: plot.x - TICK, y1: pv, x2: plot.x, y2: pv, color: theme.axisLineColor, width: 1, dash: valueDash)) }
            }
        }
    }
    if !compact {
        if spec.categoryAxisLine != false {
            axisLines.append(horizontal ? AWCChartSegment(x1: plot.x, y1: plot.y, x2: plot.x, y2: plot.y + plot.height, color: theme.axisLineColor, width: 1, dash: categoryDash)
                                        : AWCChartSegment(x1: plot.x, y1: plot.y + plot.height, x2: plot.x + plot.width, y2: plot.y + plot.height, color: theme.axisLineColor, width: 1, dash: categoryDash))
        }
        if spec.valueAxisLine != false {
            if horizontal {
                let cuts = vScale.breaks.map { (px: $0.px, gap: $0.gap) }
                axisLines += awcChartAxisLineWithBreaks("x", plot.x, plot.x + plot.width, plot.y + plot.height, cuts, theme.axisLineColor, valueDash)
                for c in cuts { axisLines += awcChartBreakBandSegments("x", plot.x + c.px, plot.x + c.px + c.gap, plot.y, plot.y + plot.height, theme.axisLineColor) }
            } else {
                let cuts = vScale.breaks.map { (px: plot.height - $0.px - $0.gap, gap: $0.gap) }
                axisLines += awcChartAxisLineWithBreaks("y", plot.y, plot.y + plot.height, plot.x, cuts, theme.axisLineColor, valueDash)
                for c in cuts { axisLines += awcChartBreakBandSegments("y", plot.y + c.px, plot.y + c.px + c.gap, plot.x, plot.x + plot.width, theme.axisLineColor) }
            }
        }
    }
    if let title = spec.title, !title.isEmpty, !compact {
        let tt = awcChartTitlePlacement(spec.titleAlign, plot.x, plot.width)
        texts.append(AWCChartTextItem(x: tt.x, y: legendBandTop + 6, text: title, color: theme.textColor, fontSize: theme.titleSize, fontWeight: 600, align: tt.align, baseline: "top", rotate: nil, key: "title"))
        if let sub = spec.subtitle, !sub.isEmpty { texts.append(AWCChartTextItem(x: tt.x, y: legendBandTop + 6 + theme.titleSize + 4, text: sub, color: theme.textColorMuted, fontSize: theme.labelSize, fontWeight: nil, align: tt.align, baseline: "top", rotate: nil, key: "subtitle")) }
    }
    if hasAxis2 && spec.valueAxis2!.hidden != true && !compact && !horizontal {
        let rx = plot.x + plot.width
        axisLines.append(AWCChartSegment(x1: rx, y1: plot.y, x2: rx, y2: plot.y + plot.height, color: theme.axisLineColor, width: 1, dash: valueDash))
        for (i, t) in v2TickVals.enumerated() {
            let pv = valPx2(t)
            if spec.axisTicks == true { axisLines.append(AWCChartSegment(x1: rx, y1: pv, x2: rx + TICK, y2: pv, color: theme.axisLineColor, width: 1, dash: valueDash)) }
            texts.append(AWCChartTextItem(x: rx + 8, y: pv, text: v2TickLabels[i], color: theme.textColorMuted, fontSize: theme.labelSize, fontWeight: nil, align: "start", baseline: "middle", rotate: nil, key: "v2t-\(i)"))
        }
        if let l = spec.valueAxis2!.label, !l.isEmpty { texts.append(AWCChartTextItem(x: width - 4, y: plot.y + plot.height / 2, text: l, color: theme.textColor, fontSize: theme.labelSize, fontWeight: nil, align: "center", baseline: "bottom", rotate: -90, key: "val2-axis-title")) }
    }
    if spec.valueHidden != true && spec.valueHideTicks != true && !compact {
        for i in valueTicks {
            let pv = valPx(vTickVals[i])
            texts.append(horizontal ? AWCChartTextItem(x: pv, y: plot.y + plot.height + 6, text: vTickLabels[i], color: theme.textColorMuted, fontSize: theme.labelSize, fontWeight: nil, align: "center", baseline: "top", rotate: nil, key: "vt-\(i)")
                                    : AWCChartTextItem(x: plot.x - 8, y: pv, text: vTickLabels[i], color: theme.textColorMuted, fontSize: theme.labelSize, fontWeight: nil, align: "end", baseline: "middle", rotate: nil, key: "vt-\(i)"))
        }
    }
    var mainPositions: [Double] = []
    let minSpacing = horizontal ? theme.labelSize + 6 : 48
    let step = Swift.max(1, Int((Double(C) / Double(Swift.max(1, Int((mainLen / minSpacing).rounded(.down))))).rounded(.up)))
    for i in 0..<Swift.max(0, C) {
        let bc = bandCenter(i)
        mainPositions.append(bc)
        let atTick = i % step == 0
        if spec.axisTicks == true && !compact && atTick && spec.categoryHidden != true {
            axisLines.append(horizontal ? AWCChartSegment(x1: plot.x - TICK, y1: bc, x2: plot.x, y2: bc, color: theme.axisLineColor, width: 1, dash: nil) : AWCChartSegment(x1: bc, y1: yb, x2: bc, y2: yb + TICK, color: theme.axisLineColor, width: 1, dash: nil))
        }
        if spec.categoryHidden == true || spec.categoryHideTicks == true || compact || !atTick { continue }
        if horizontal {
            texts.append(AWCChartTextItem(x: plot.x - 8 - lowEndRoom, y: bc, text: catLabels[i], color: theme.textColorMuted, fontSize: theme.labelSize, fontWeight: nil, align: "end", baseline: "middle", rotate: nil, key: "ct-\(i)"))
            if mirrorCats { texts.append(AWCChartTextItem(x: plot.x + plot.width + 8 + (spec.showLabels ? maxDataLabelW + 4 : 0), y: bc, text: catLabels[i], color: theme.textColorMuted, fontSize: theme.labelSize, fontWeight: nil, align: "start", baseline: "middle", rotate: nil, key: "ctm-\(i)")) }
        } else if catRot != 0 {
            let w = awcChartApproxWidth(catLabels[i], theme.labelSize)
            let dir: Double = catRot < 0 ? -1 : 1
            texts.append(AWCChartTextItem(x: bc + (dir * w * cos(catRotRad)) / 2, y: plot.y + plot.height + 6 + lowEndRoom + (w * sin(catRotRad)) / 2, text: catLabels[i], color: theme.textColorMuted, fontSize: theme.labelSize, fontWeight: nil, align: "center", baseline: "middle", rotate: catRot, key: "ct-\(i)"))
        } else {
            let nextC = i + step < C ? bandCenter(i + step) : bc + Double(step) * sizeAt(i)
            let prevC = i - step >= 0 ? bandCenter(i - step) : bc - Double(step) * sizeAt(i)
            let room = Swift.min(nextC - bc, bc - prevC) - 6
            texts.append(AWCChartTextItem(x: bc, y: plot.y + plot.height + 6 + lowEndRoom, text: awcEllipsize(catLabels[i], room, theme.labelSize), color: theme.textColorMuted, fontSize: theme.labelSize, fontWeight: nil, align: "center", baseline: "top", rotate: nil, key: "ct-\(i)"))
        }
    }
    if !compact {
        if horizontal {
            if let t = spec.categoryLabel, !t.isEmpty { texts.append(AWCChartTextItem(x: 4, y: plot.y + plot.height / 2, text: t, color: theme.textColor, fontSize: theme.labelSize, fontWeight: nil, align: "center", baseline: "top", rotate: -90, key: "cat-axis-title")) }
            if let t = spec.valueLabel, !t.isEmpty { texts.append(AWCChartTextItem(x: plot.x + plot.width / 2, y: height - 2 - legendBandBottom, text: t, color: theme.textColor, fontSize: theme.labelSize, fontWeight: nil, align: "center", baseline: "bottom", rotate: nil, key: "val-axis-title")) }
        } else {
            if let t = spec.valueLabel, !t.isEmpty { texts.append(AWCChartTextItem(x: 4, y: plot.y + plot.height / 2, text: t, color: theme.textColor, fontSize: theme.labelSize, fontWeight: nil, align: "center", baseline: "top", rotate: -90, key: "val-axis-title")) }
            if let t = spec.categoryLabel, !t.isEmpty { texts.append(AWCChartTextItem(x: plot.x + plot.width / 2, y: height - 2 - legendBandBottom, text: t, color: theme.textColor, fontSize: theme.labelSize, fontWeight: nil, align: "center", baseline: "bottom", rotate: nil, key: "cat-axis-title")) }
        }
    }
    let legend: [AWCChartLegendItem] = spec.legend == "none" || compact ? [] : spec.series.enumerated().map { AWCChartLegendItem(label: $1.label, color: $1.color, seriesIndex: $0, hidden: $1.hidden, x: 0, y: 0) }
    return AWCChartScene(barBaseline: basePx, width: width, height: height, plot: plot, background: theme.background == "transparent" ? nil : theme.background, bands: nil,
                         gridlines: gridlines, axisLines: axisLines, areas: [], bars: bars, slices: [], lines: [], markers: [], glyphs: nil, endLabels: nil, texts: texts,
                         barLabels: barLabels, legend: legend, legendPosition: spec.legend, xPositions: mainPositions, xValues: spec.categories, xLabels: catLabels, hoverPoints: hoverPoints)
}

private func awcChartRadialScene(_ spec: AWCChartBarSpec, _ theme: AWCChartEngineTheme, _ width: Double, _ height: Double, _ bands: [[AWCChartBandCell]], _ vDomain: AWCChartDomain, _ catLabels: [String], _ C: Int, _ stacked: Bool, _ stackKeys: [String]) -> AWCChartScene {
    var texts: [AWCChartTextItem] = []
    let subtitleH = (spec.subtitle?.isEmpty == false) ? theme.labelSize + 4 : 0
    let titleH = (spec.title?.isEmpty == false) ? theme.titleSize + 10 + subtitleH : 0
    let legendActive = (spec.legend?.isEmpty == false) && spec.legend != "none" && spec.series.count > 1
    let legendAtBottom = legendActive && spec.legend!.hasPrefix("bottom")
    let legendTopRow = legendActive && !legendAtBottom && !(spec.legend == "left" || spec.legend == "right")
    let legendRows = legendActive ? awcChartEstimateLegendRows(spec.series.map(\.label), theme.labelSize, width * 0.86) : 1
    let legendBandH = spec.legendExtent != nil && (legendTopRow || legendAtBottom) ? spec.legendExtent! + 8 : Double(legendRows) * (theme.labelSize + 8) + 6
    let legendBandTop = legendTopRow ? legendBandH : 0, legendBandBottom = legendAtBottom ? legendBandH : 0
    let nameGutter = spec.categoryHidden == true || spec.categoryHideTicks == true ? 0 : awcMax(0, catLabels.map { awcChartApproxWidth($0, theme.labelSize) }) + 12
    let plot = AWCChartRect(x: nameGutter, y: titleH + legendBandTop, width: Swift.max(1, width - nameGutter), height: Swift.max(1, height - titleH - legendBandTop - legendBandBottom))
    let cx = plot.x + plot.width / 2, cy = plot.y + plot.height / 2
    let vFmt = spec.valueTickFormatter ?? spec.valueFormatter
    let vTicks = spec.valueHidden == true || spec.valueHideTicks == true ? [] : awcSectionedTicks(vDomain, [], spec.valueScale, 8).filter { $0 >= vDomain.0 - 1e-9 && $0 <= vDomain.1 + 1e-9 }
    let vTickMaxW = awcMax(0, vTicks.map { awcChartApproxWidth(vFmt($0), theme.labelSize) })
    let valueGutter = !vTicks.isEmpty ? vTickMaxW + 18 : 0
    let R = Swift.max(8, Swift.min(plot.width, plot.height) / 2 - 8 - valueGutter)
    let hole = R * Swift.max(0, Swift.min(0.9, spec.polarHole ?? 0.22))
    let ring = C > 0 ? (R - hole) / Double(C) : R - hole
    let thickness = Swift.max(1, ring * (1 - spec.categoryGapRatio))
    let visibleIdx = spec.series.indices.filter { !spec.series[$0].hidden && spec.series[$0].overlay != true }
    var groupNames: [String] = []
    for i in visibleIdx where !groupNames.contains(stackKeys[i]) { groupNames.append(stackKeys[i]) }
    let slotCount = Double(stacked ? Swift.max(1, groupNames.count) : Swift.max(1, visibleIdx.count))
    let subThickness = thickness / (slotCount + (slotCount - 1) * spec.barGapRatio)
    func slotOf(_ si: Int) -> Int { spec.series[si].overlay == true ? -1 : stacked ? Swift.max(0, groupNames.firstIndex(of: stackKeys[si]) ?? -1) : Swift.max(0, visibleIdx.firstIndex(of: si) ?? -1) }
    let START = -Double.pi / 2
    let sweep = 2 * Double.pi * Swift.max(0.1, Swift.min(1, spec.polarSweep ?? 0.75))
    let lo = vDomain.0, hi = vDomain.1
    let spanRaw = hi - lo
    let span = spanRaw == 0 || spanRaw.isNaN ? 1 : spanRaw
    func angleOf(_ v: Double) -> Double { START + ((v - lo) / span) * sweep }
    var slices: [AWCChartSceneSlice] = [], hoverPoints: [AWCChartHoverSeries] = []
    let midRadii = (0..<Swift.max(0, C)).map { R - Double($0) * ring - thickness / 2 }
    for (si, s) in spec.series.enumerated() where !s.hidden {
        var byIndex: [Int: AWCChartHoverPoint] = [:]
        for i in 0..<Swift.max(0, C) {
            guard i < bands[si].count, let band = bands[si][i].band else { continue }
            let slot = slotOf(si)
            let outerR = R - Double(i) * ring - (slot < 0 ? 0 : Double(slot) * subThickness * (1 + spec.barGapRatio))
            let innerR = outerR - (slot < 0 ? thickness : subThickness)
            let a0 = angleOf(band.0), a1 = angleOf(band.1)
            if abs(a1 - a0) < 1e-6 { continue }
            slices.append(AWCChartSceneSlice(cx: cx, cy: cy, innerR: innerR, outerR: outerR, startAngle: Swift.min(a0, a1), endAngle: Swift.max(a0, a1), color: s.pointColors?[i] ?? s.color, dataIndex: i, seriesIndex: si, pill: true, capStart: false, capEnd: false))
            let mid = (a0 + a1) / 2, midR = (innerR + outerR) / 2
            let v: Double = { if i < s.data.count, case .num(let n) = s.data[i] { return n }; return band.1 }()
            byIndex[i] = AWCChartHoverPoint(x: cx + midR * cos(mid), y: cy + midR * sin(mid), value: v, low: nil, high: nil, symbol: nil, color: nil)
        }
        hoverPoints.append(AWCChartHoverSeries(seriesIndex: si, color: s.color, label: s.label, unanchored: nil, byIndex: byIndex, values: s.data, valueFormat: nil))
    }
    var seenKeys: [String] = []
    for sl in slices { let k = "\(sl.dataIndex)|\(slotOf(sl.seriesIndex ?? 0))"; if !seenKeys.contains(k) { seenKeys.append(k) } }
    for key in seenKeys {
        let idx = slices.indices.filter { "\(slices[$0].dataIndex)|\(slotOf(slices[$0].seriesIndex ?? 0))" == key }
        guard var first = idx.first, var last = idx.first else { continue }
        for k in idx { if slices[k].startAngle < slices[first].startAngle { first = k }; if slices[k].endAngle > slices[last].endAngle { last = k } }
        slices[first].capStart = true
        slices[last].capEnd = true
    }
    let labelR = R + 16
    for t in vTicks {
        let a = angleOf(t), c = cos(a), s = sin(a)
        texts.append(AWCChartTextItem(x: cx + labelR * c, y: cy + labelR * s, text: vFmt(t), color: theme.textColorMuted, fontSize: theme.labelSize, fontWeight: nil,
                                      align: c > 0.35 ? "start" : c < -0.35 ? "end" : "center", baseline: s > 0.35 ? "top" : s < -0.35 ? "bottom" : "middle", rotate: nil, key: "vt-\(awcJSNumberString(t))"))
    }
    if spec.categoryHidden != true && spec.categoryHideTicks != true {
        for i in 0..<Swift.max(0, C) { texts.append(AWCChartTextItem(x: cx - thickness / 2 - 12, y: cy - midRadii[i], text: catLabels[i], color: theme.textColorMuted, fontSize: theme.labelSize, fontWeight: nil, align: "end", baseline: "middle", rotate: nil, key: "ct-\(i)")) }
    }
    if let title = spec.title, !title.isEmpty {
        let tt = awcChartTitlePlacement(spec.titleAlign, plot.x, plot.width)
        texts.append(AWCChartTextItem(x: tt.x, y: legendBandTop + 6, text: title, color: theme.textColor, fontSize: theme.titleSize, fontWeight: 600, align: tt.align, baseline: "top", rotate: nil, key: "title"))
        if let sub = spec.subtitle, !sub.isEmpty { texts.append(AWCChartTextItem(x: tt.x, y: legendBandTop + 6 + theme.titleSize + 6, text: sub, color: theme.textColorMuted, fontSize: theme.labelSize, fontWeight: nil, align: tt.align, baseline: "top", rotate: nil, key: "subtitle")) }
    }
    let legend: [AWCChartLegendItem] = spec.legend == "none" ? [] : spec.series.enumerated().map { AWCChartLegendItem(label: $1.label, color: $1.color, seriesIndex: $0, hidden: $1.hidden, x: 0, y: 0) }
    var scene = AWCChartScene(barBaseline: nil, width: width, height: height, plot: plot, background: theme.background == "transparent" ? nil : theme.background, bands: nil,
                              gridlines: [], axisLines: [], areas: [], bars: [], slices: slices, lines: [], markers: [], glyphs: nil, endLabels: nil, texts: texts, barLabels: nil,
                              legend: legend, legendPosition: spec.legend, xPositions: midRadii, xValues: spec.categories, xLabels: catLabels, hoverPoints: hoverPoints)
    scene.polar = true
    return scene
}
