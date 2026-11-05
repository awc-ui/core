import Foundation

// md-bar-chart `buildSpec`, md-sparkline's compact specs, and the engines' render passes.

/// md-bar-chart `parseRatio`.
func awcChartParseRatio(_ v: AWCValue?, _ fallback: Double) -> Double {
    if case .number(let d)? = v { return d.isFinite ? (d > 1 ? d / 100 : d) : fallback }
    let s = v?.string ?? ""
    let n = awcJSParseFloat(s)
    if !n.isFinite { return fallback }
    return s.trimmingCharacters(in: .whitespaces).hasSuffix("%") || n > 1 ? n / 100 : n
}

func awcChartNumberMap(_ v: AWCValue?) -> [Int: Double]? {
    guard let v, case .object(let o) = v else { return nil }
    var out: [Int: Double] = [:]
    for (k, val) in o { if let i = Int(k), case .number(let d) = val { out[i] = d } }
    return out
}

func awcChartBuildBarSpec(_ input: AWCChartCartesianInput, theme t: AWCChartTheme) -> AWCChartBarSpec {
    let pr = input.props
    let stack = pr.str("stack", "none")
    let percentage = stack == "percentage"
    let locale = pr.str("locale", "")
    let vf = input.formatters.valueFormatter
    let vFmt: (Double) -> String = { v in vf != nil ? vf!(v) : AWCChartIntl.number(v, locale) }
    let polar = pr.bool("polar")
    let zw = polar ? nil : input.zoomWindow
    func cut<T>(_ a: [T]) -> [T] { guard let zw else { return a }; let lo = Swift.min(zw.start, a.count); return Array(a[lo..<Swift.max(lo, Swift.min(zw.end + 1, a.count))]) }
    func rebase<T>(_ rec: [Int: T]?) -> [Int: T]? {
        guard let rec, let zw else { return rec }
        var out: [Int: T] = [:]; for (k, v) in rec { let i = k - zw.start; if i >= 0 && i <= zw.end - zw.start { out[i] = v } }; return out
    }
    let seriesValues = pr.obj("series")?.array ?? []
    let keys = awcChartSeriesKeys(seriesValues)
    let xAxis = pr.obj("xAxis"), yAxis = pr.obj("yAxis"), yAxis2 = pr.obj("yAxis2")
    let layout = pr.str("layout", "vertical")
    let xf = input.formatters.xAxisFormatter
    let series: [AWCChartBarSeriesSpec] = seriesValues.enumerated().map { i, s in
        var pointColors: [Int: String]? = nil
        if case .object(let pc) = s["pointColors"] {
            var resolved: [Int: String] = [:]
            for (k, c) in pc { if let ki = Int(k) { resolved[ki] = awcChartResolveSeriesColor(input.tokens, c.string, awcChartPickPaletteColor(t.palette, i)) } }
            pointColors = rebase(resolved)
        }
        return AWCChartBarSeriesSpec(label: s["label"] == .null ? "Series \(i + 1)" : s["label"].string,
                                     color: awcChartResolveSeriesColor(input.tokens, s["color"] == .null ? nil : s["color"].string, awcChartPickPaletteColor(t.palette, i)),
                                     data: cut(s["data"].array.map { if case .number(let n) = $0 { return .num(n) }; return .null }),
                                     hidden: input.hiddenOverride[i] ?? s["hidden"].bool ?? input.legendHidden[keys[i]] ?? false,
                                     range: s["range"] == .null ? nil : cut(s["range"].array).map(awcChartNormalizeRange),
                                     pointWidths: rebase(awcChartNumberMap(s["pointWidths"])), axisIndex: s["yAxisIndex"].number.map { Int($0) },
                                     overlay: s["overlay"].bool, widthRatio: s["widthRatio"].number, stack: s["stack"] == .null ? nil : s["stack"].string, pointColors: pointColors)
    }
    let label = pr.str("label", ""), subtitle = pr.str("subtitle", "")
    func axisStr(_ a: AWCValue?, _ k: String) -> String? { guard let a, a[k] != .null else { return nil }; return a[k].string }
    var spec = AWCChartBarSpec(series: series, title: label.isEmpty ? nil : label, titleAlign: pr.str("titleAlign", "start"),
                               categories: cut(xAxis.map { $0["data"].array.compactMap(awcChartAxisValue) } ?? []),
                               // md-bar-chart passes defaultValueFormatter without the component locale.
                               categoryFormatter: { v in xf != nil ? xf!(v) : awcChartDefaultValueFormatter(v, "") },
                               valueFormatter: percentage ? { v in "\(Int(awcJSRound(v)))%" } : vFmt,
                               stack: stack, horizontal: layout == "horizontal",
                               categoryGapRatio: awcChartParseRatio(pr.p["categoryGap"] ?? .string("30%"), 0.3), barGapRatio: awcChartParseRatio(pr.p["barGap"] ?? .string("20%"), 0.2),
                               cornerRadius: pr.num("cornerRadius", 6), showLabels: pr.bool("showLabels"))
    spec.subtitle = subtitle.isEmpty ? nil : subtitle
    spec.categoryLabelRotation = xAxis?["labelRotation"].number
    spec.categoryLabelsMirrored = xAxis?["mirrorLabels"].bool
    if let a2 = yAxis2 { spec.valueAxis2 = AWCChartValueAxis2(min: a2["min"].number, max: a2["max"].number, label: axisStr(a2, "label"), formatter: input.formatters.yAxesFormatters[1], hidden: a2["hidden"].bool) }
    spec.valueTickFormatter = input.formatters.yAxisFormatter
    spec.categoryLabel = axisStr(xAxis, "label"); spec.categoryHidden = xAxis?["hidden"].bool; spec.categoryHideTicks = xAxis?["hideTicks"].bool
    spec.categoryAxisLine = xAxis?["axisLine"].bool; spec.categoryDash = axisStr(xAxis, "dash")
    spec.valueScale = yAxis.flatMap { AWCChartScaleType(rawValue: $0["scale"].string) } ?? .value
    let breakAxis = layout == "horizontal" ? xAxis : yAxis
    spec.valueBreaks = awcChartBreaks(breakAxis?["breaks"] == .null ? nil : breakAxis?["breaks"])
    spec.valueMin = percentage ? 0 : yAxis?["min"].number
    spec.valueMax = percentage ? 100 : yAxis?["max"].number
    spec.valueLabel = axisStr(yAxis, "label"); spec.valueHidden = yAxis?["hidden"].bool; spec.valueHideTicks = yAxis?["hideTicks"].bool
    spec.valueAxisLine = yAxis?["axisLine"].bool; spec.valueDash = axisStr(yAxis, "dash"); spec.valueGridDash = axisStr(yAxis, "gridDash")
    spec.barWidth = pr.num("barWidth"); spec.showTotals = pr.bool("showTotals"); spec.chevron = pr.bool("chevron")
    spec.polar = polar; spec.polarHole = pr.num("polarHole"); spec.polarSweep = pr.num("polarSweep")
    spec.legend = pr.str("legend", "top-end"); spec.axisTicks = pr.bool("axisTicks")
    spec.animation = pr.bool("noAnimation") ? "none" : pr.str("animation", "expressive"); spec.animationDuration = pr.num("animationDuration")
    return spec
}

/// bar-chart.ts render(): layout (value ticks measured in `400 labelSize` of the chart font), RTL mirror, measured legend.
func awcChartRenderBarScene(_ spec: inout AWCChartBarSpec, _ theme: AWCChartEngineTheme, width: Double, height: Double, rtl: Bool) -> AWCChartScene {
    func layout() -> AWCChartScene {
        let s = awcChartComputeBarLayout(spec, theme, width, height, measureLabel: { AWCChartTextMetrics.width($0, size: theme.labelSize) })
        return rtl ? awcChartMirrorScene(s) : s
    }
    var scene = layout()
    if let legend = spec.legend, legend != "none", let extent = awcChartLegendExtent(scene), extent > 0, abs((spec.legendExtent ?? -1) - extent) > 2 {
        spec.legendExtent = extent
        scene = layout()
    }
    return scene
}

// MARK: md-sparkline

/// md-sparkline `bandFill`.
func awcChartSparkBandFill(_ color: String, _ alpha: Double, explicit: Bool) -> String {
    let c = awcChartParseColor(color)
    func ch(_ v: Double) -> Int { Int(awcJSRound(v * 255)) }
    let out = explicit ? (c.3 < 1 ? c.3 : alpha) : c.3 * alpha
    return "rgba(\(ch(c.0)), \(ch(c.1)), \(ch(c.2)), \(awcJSNumberString(awcJSRound(out * 1000) / 1000)))"
}

/// md-sparkline `markIndices`.
func awcChartSparkMarkIndices(_ data: [AWCChartCell], _ showMarks: String) -> [Int] {
    let nums: [(Int, Double)] = data.enumerated().compactMap { i, d in if case .num(let v) = d { return (i, v) }; return nil }
    if nums.isEmpty || showMarks == "none" { return [] }
    if showMarks == "all" { return nums.map(\.0) }
    var set: [Int] = []
    func add(_ i: Int) { if !set.contains(i) { set.append(i) } }
    if showMarks == "extremes" {
        var mx = nums[0], mn = nums[0]
        for n in nums { if n.1 > mx.1 { mx = n }; if n.1 < mn.1 { mn = n } }
        add(mx.0); add(mn.0)
    }
    if showMarks == "edges" { add(nums[0].0); add(nums[nums.count - 1].0) }
    return set
}

struct AWCChartSparkInput { var props: AWCChartProps; var tokens: [String: String]; var formatters = AWCChartFormatters() }

private func awcSparkData(_ pr: AWCChartProps) -> [AWCChartCell] { (pr.obj("data")?.array ?? []).map { if case .number(let n) = $0 { return .num(n) }; return .null } }
private func awcSparkLabels(_ pr: AWCChartProps, _ n: Int) -> [AWCChartAxisValue] { pr.obj("labels").map { $0.array.compactMap(awcChartAxisValue) } ?? (0..<n).map { .number(Double($0)) } }

func awcChartSparkColor(_ input: AWCChartSparkInput, _ t: AWCChartTheme) -> String {
    awcChartResolveSeriesColor(input.tokens, input.props.str("color", "primary"), awcChartPickPaletteColor(t.palette, 0))
}

func awcChartBuildSparkLineSpec(_ input: AWCChartSparkInput, color: String) -> AWCChartLineSpec {
    let pr = input.props
    let data = awcSparkData(pr)
    let vf = input.formatters.valueFormatter
    var s = AWCChartLineSeriesSpec(label: "", color: color, data: data)
    s.curve = pr.str("curve", "smooth"); s.connectNulls = true; s.showMarks = false; s.hidden = false
    s.markIndices = awcChartSparkMarkIndices(data, pr.str("showMarks", "extremes")); s.lineWidth = pr.num("lineWidth"); s.markSize = pr.num("markSize")
    var spec = AWCChartLineSpec(series: [s])
    spec.xValues = awcSparkLabels(pr, data.count); spec.xScale = .category; spec.xFormatter = { awcChartDefaultAxisString($0) }; spec.xHidden = true
    spec.yScale = .value; spec.yMin = pr.num("min"); spec.yMax = pr.num("max"); spec.yFormatter = { v in vf != nil ? vf!(v) : AWCChartIntl.number(v, "") }; spec.yHidden = true
    spec.stack = "none"; spec.area = pr.str("variant", "line") == "area"; spec.fillOpacity = 0.45; spec.legend = "none"; spec.compact = true
    spec.refBands = pr.obj("referenceAreas").map { $0.array.map { a in
        let c = a["color"] == .null ? nil : a["color"].string
        return AWCChartRefBand(from: a["from"].number ?? .nan, to: a["to"].number ?? .nan, color: c != nil ? awcChartSparkBandFill(c!, 0.18, explicit: true) : awcChartSparkBandFill(color, 0.12, explicit: false))
    } }
    spec.animate = !pr.bool("noAnimation")
    return spec
}

func awcChartBuildSparkBarSpec(_ input: AWCChartSparkInput, color: String) -> AWCChartBarSpec {
    let pr = input.props
    let data = awcSparkData(pr)
    let vf = input.formatters.valueFormatter
    var spec = AWCChartBarSpec(series: [AWCChartBarSeriesSpec(label: "", color: color, data: data, hidden: false)], categories: awcSparkLabels(pr, data.count),
                               categoryFormatter: { awcChartDefaultAxisString($0) }, valueFormatter: { v in vf != nil ? vf!(v) : AWCChartIntl.number(v, "") },
                               stack: "none", horizontal: false, categoryGapRatio: 0.2, barGapRatio: 0, cornerRadius: pr.num("cornerRadius", 2), showLabels: false)
    spec.categoryHidden = true; spec.valueMin = pr.num("min"); spec.valueMax = pr.num("max"); spec.valueHidden = true
    spec.barWidth = pr.num("barWidth"); spec.legend = "none"; spec.compact = true
    return spec
}

/// The sparkline scene through the same engine passes as the Web component (transparent background).
func awcChartRenderSparkScene(_ input: AWCChartSparkInput, theme t: AWCChartTheme, width: Double, height: Double, rtl: Bool) -> AWCChartScene {
    let color = awcChartSparkColor(input, t)
    var theme = t.engine; theme.background = "transparent"
    if input.props.str("variant", "line") == "bar" { var spec = awcChartBuildSparkBarSpec(input, color: color); return awcChartRenderBarScene(&spec, theme, width: width, height: height, rtl: rtl) }
    var spec = awcChartBuildSparkLineSpec(input, color: color)
    return awcChartRenderScene(&spec, theme, width: width, height: height, rtl: rtl)
}
