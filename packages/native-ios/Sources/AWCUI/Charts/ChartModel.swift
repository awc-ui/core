import Foundation
import CoreText

// Component-side model shared by md-line-chart / md-area-chart (and the cartesian parts of the bar
// chart): properties → engine spec, the theme read (theme.ts readMdChartTheme), xy.ts normalisation,
// the legend measurement pass and the RTL mirror (chart.ts render()).

/// Author callbacks the Web component accepts as function-valued properties.
public struct AWCChartFormatters {
    public var valueFormatter: ((Double?) -> String)?
    public var xAxisFormatter: ((AWCChartAxisValue) -> String)?
    public var yAxisFormatter: ((Double) -> String)?
    public var yAxesFormatters: [Int: (Double) -> String] = [:]
    /// `tooltipRenderer`: nil return = no card at this index, `.text` = plain content, `.default` = keep the built-in card.
    public var tooltipRenderer: ((AWCChartTooltipContext) -> AWCChartTooltipContent)? = nil
    public init(valueFormatter: ((Double?) -> String)? = nil, xAxisFormatter: ((AWCChartAxisValue) -> String)? = nil, yAxisFormatter: ((Double) -> String)? = nil) {
        self.valueFormatter = valueFormatter; self.xAxisFormatter = xAxisFormatter; self.yAxisFormatter = yAxisFormatter
    }
}

/// theme.ts `MdChartTheme`, read from the native theme tokens.
struct AWCChartTheme {
    var background = "transparent"
    var textColor: String
    var textColorMuted: String
    var gridColor: String
    var axisLineColor: String
    var surface: String
    var tooltipSurface: String
    var tooltipTextColor: String
    var tooltipRadius: Double
    var palette: [String]
    var fontFamily: String
    var labelSize: Double
    var titleSize: Double
    var engine: AWCChartEngineTheme {
        AWCChartEngineTheme(background: background, textColor: textColor, textColorMuted: textColorMuted, axisLineColor: axisLineColor, gridLineColor: gridColor, surface: surface, fontFamily: fontFamily, labelSize: labelSize, titleSize: titleSize)
    }
}

let awcChartRoleTokens: [String: String] = [
    "primary": "--md-sys-color-primary", "secondary": "--md-sys-color-secondary", "tertiary": "--md-sys-color-tertiary", "error": "--md-sys-color-error",
    "primary-container": "--md-sys-color-primary-container", "secondary-container": "--md-sys-color-secondary-container",
    "tertiary-container": "--md-sys-color-tertiary-container", "error-container": "--md-sys-color-error-container",
    "surface-variant": "--md-sys-color-surface-variant", "success": "--md-sys-color-success", "warning": "--md-sys-color-warning", "info": "--md-sys-color-info",
    "success-container": "--md-sys-color-success-container", "warning-container": "--md-sys-color-warning-container", "info-container": "--md-sys-color-info-container",
]
let awcChartRoleFallbacks: [String: String] = [
    "primary": "#6750A4", "secondary": "#625B71", "tertiary": "#7D5260", "error": "#B3261E", "primary-container": "#EADDFF", "secondary-container": "#E8DEF8",
    "tertiary-container": "#FFD8E4", "error-container": "#F9DEDC", "surface-variant": "#E7E0EC", "success": "#2E6B4F", "warning": "#7A5900", "info": "#38608F",
    "success-container": "#B8F0CE", "warning-container": "#FFDF9B", "info-container": "#D3E4FF",
]
private let awcChartRoleCycle = ["primary", "tertiary", "secondary", "error", "primary-container", "tertiary-container", "secondary-container", "error-container"]

func awcChartToken(_ tokens: [String: String], _ name: String, _ fallback: String) -> String {
    let v = (tokens[name] ?? "").trimmingCharacters(in: .whitespaces)
    return v.isEmpty ? fallback : v
}

func awcChartNumberToken(_ tokens: [String: String], _ name: String, _ fallback: Double) -> Double {
    let raw = (tokens[name] ?? "").trimmingCharacters(in: .whitespaces)
    if raw.isEmpty { return fallback }
    let n = awcJSParseFloat(raw)
    return n.isFinite ? n : fallback
}

func awcChartResolveRole(_ tokens: [String: String], _ role: String) -> String {
    awcChartToken(tokens, awcChartRoleTokens[role]!, awcChartRoleFallbacks[role]!)
}

/// theme.ts `fontFamilyOf`: the family list after the size in a `font` shorthand.
func awcChartFontFamilyOf(_ font: String) -> String {
    if let re = try? NSRegularExpression(pattern: #"\d*\.?\d+(?:px|rem|em|pt|%)(?:\s*/\s*\S+)?\s+(.+)$"#),
       let m = re.firstMatch(in: font, range: NSRange(font.startIndex..., in: font)), let r = Range(m.range(at: 1), in: font) {
        return String(font[r]).trimmingCharacters(in: .whitespaces)
    }
    return font.trimmingCharacters(in: .whitespaces)
}

func awcChartReadTheme(tokens: [String: String], density: Double) -> AWCChartTheme {
    let outlineVariant = awcChartToken(tokens, "--md-sys-color-outline-variant", "#CAC4D0")
    let gridOverride = awcChartToken(tokens, "--md-chart-grid-color", "")
    let labelBase = awcChartNumberToken(tokens, "--md-sys-typescale-label-small-size", awcChartNumberToken(tokens, "--md-sys-typescale-label-small-font-size", 11))
    let titleBase = awcChartNumberToken(tokens, "--md-sys-typescale-title-small-size", awcChartNumberToken(tokens, "--md-sys-typescale-title-small-font-size", 14))
    return AWCChartTheme(
        textColor: awcChartToken(tokens, "--md-sys-color-on-surface", "#1C1B1F"),
        textColorMuted: awcChartToken(tokens, "--md-sys-color-on-surface-variant", "#49454F"),
        gridColor: gridOverride.isEmpty ? awcChartWithAlpha(outlineVariant, 0.5) : gridOverride,
        axisLineColor: awcChartToken(tokens, "--md-chart-axis-color", outlineVariant),
        surface: awcChartToken(tokens, "--md-sys-color-surface", "#FFFBFE"),
        tooltipSurface: awcChartToken(tokens, "--md-sys-color-inverse-surface", awcChartToken(tokens, "--md-sys-color-on-surface", "#322F35")),
        tooltipTextColor: awcChartToken(tokens, "--md-sys-color-inverse-on-surface", awcChartToken(tokens, "--md-sys-color-surface", "#F5EFF7")),
        tooltipRadius: awcChartNumberToken(tokens, "--md-sys-shape-corner-small", 8),
        palette: awcChartRoleCycle.map { awcChartResolveRole(tokens, $0) },
        fontFamily: awcChartFontFamilyOf(awcChartToken(tokens, "--md-sys-typescale-label-medium-font", "\"Roboto\", system-ui, sans-serif")),
        labelSize: Swift.max(9, labelBase + density * 0.5),
        titleSize: Swift.max(11, titleBase + density * 0.5))
}

/// theme.ts `resolveSeriesColor`: a role name → its token, a valid CSS colour as authored, else the fallback.
func awcChartResolveSeriesColor(_ tokens: [String: String], _ color: String?, _ fallback: String) -> String {
    guard let color, !color.isEmpty else { return fallback }
    if awcChartRoleTokens[color] != nil { return awcChartResolveRole(tokens, color) }
    if !awcChartIsCSSColor(color) { return fallback }
    return color
}

/// `CSS.supports('color', value)` for the colour syntaxes the native parser understands.
func awcChartIsCSSColor(_ value: String) -> Bool {
    let s = value.trimmingCharacters(in: .whitespaces)
    if s.lowercased().hasPrefix("var(") || s.lowercased().hasPrefix("color-mix(") { return true }
    let parsed = awcChartParseColor(s)
    if parsed != (0.5, 0.5, 0.5, 1) { return true }
    return s.lowercased() == "gray" || s.lowercased() == "grey" || s == "#808080" || s.lowercased() == "rgb(128, 128, 128)" || s.lowercased() == "rgb(127.5, 127.5, 127.5)"
}

func awcChartPickPaletteColor(_ palette: [String], _ i: Int) -> String { palette[i % palette.count] }

// MARK: Data parsing (AWCValue → chart values)

func awcChartAxisValue(_ v: AWCValue) -> AWCChartAxisValue? {
    switch v {
    case .number(let n): return .number(n)
    case .string(let s): return .string(s)
    case .bool(let b): return .string(b ? "true" : "false")
    default: return nil
    }
}

/// xy.ts: a point datum is an object ({x,y}) or a tuple ([x,y]).
private func awcChartIsPointDatum(_ d: AWCValue) -> Bool {
    switch d { case .object, .array: return true; default: return false }
}
private func awcChartDatumY(_ d: AWCValue) -> AWCChartCell {
    switch d {
    case .number(let n): return .num(n)
    case .object(let o): if let y = o["y"] { if case .number(let n) = y { return .num(n) }; return .null }; return .null
    case .array(let a): if a.count > 1, case .number(let n) = a[1] { return .num(n) }; return .null
    default: return .null
    }
}
private func awcChartDatumX(_ d: AWCValue) -> AWCChartAxisValue? {
    switch d {
    case .object(let o): return o["x"].flatMap(awcChartAxisValue)
    case .array(let a): return a.first.flatMap(awcChartAxisValue)
    default: return nil
    }
}

struct AWCChartNormalizedX {
    var xValues: [AWCChartAxisValue]
    var data: [[AWCChartCell]]
    var toMerged: [[Int]?]
    var toOwn: [[Int]?]
    var hasPointX: Bool
}

/// xy.ts `normalizeSeriesX`.
func awcChartNormalizeSeriesX(_ series: [[AWCValue]], _ axisData: [AWCChartAxisValue]?, _ scale: AWCChartScaleType) -> AWCChartNormalizedX {
    func hasPointX(_ data: [AWCValue]) -> Bool { data.first { if case .null = $0 { return false }; return true }.map(awcChartIsPointDatum) ?? false }
    let anyPoint = series.contains(where: hasPointX)
    if !anyPoint {
        return AWCChartNormalizedX(xValues: axisData ?? [], data: series.map { $0.map { d -> AWCChartCell in if case .number(let n) = d { return .num(n) }; return .null } },
                                   toMerged: series.map { _ in nil }, toOwn: series.map { _ in nil }, hasPointX: false)
    }
    let category = scale == .category
    func keyOf(_ v: AWCChartAxisValue) -> String {
        category ? "c" + awcChartDefaultAxisString(v) : "n" + awcJSNumberString(awcChartToNumeric(v, scale))
    }
    var order: [String] = [], slots: [String: (sort: Double, value: AWCChartAxisValue)] = [:]
    func add(_ v: AWCChartAxisValue) { let k = keyOf(v); if slots[k] == nil { slots[k] = (category ? Double(slots.count) : awcChartToNumeric(v, scale), v); order.append(k) } }
    axisData?.forEach(add)
    for s in series where hasPointX(s) { for d in s { if let x = awcChartDatumX(d) { add(x) } } }
    let xValues = order.map { slots[$0]! }.awcStableSorted { $0.sort < $1.sort }.map(\.value)
    var indexOf: [String: Int] = [:]
    for (i, v) in xValues.enumerated() { indexOf[keyOf(v)] = i }
    let n = xValues.count
    var data: [[AWCChartCell]] = [], toMerged: [[Int]?] = [], toOwn: [[Int]?] = []
    for own in series {
        var row = [AWCChartCell](repeating: .hole, count: n)
        if !hasPointX(own) {
            guard let axisData, !axisData.isEmpty else {
                for j in 0..<Swift.min(own.count, n) { row[j] = awcChartDatumY(own[j]) }
                data.append(row); toMerged.append(nil); toOwn.append(nil); continue
            }
            var fwd = [Int](repeating: -1, count: own.count), back = [Int](repeating: -1, count: n)
            for j in 0..<own.count {
                guard j < axisData.count, let at = indexOf[keyOf(axisData[j])] else { continue }
                row[at] = awcChartDatumY(own[j]); fwd[j] = at; back[at] = j
            }
            data.append(row); toMerged.append(fwd); toOwn.append(back); continue
        }
        var fwd = [Int](repeating: -1, count: own.count), back = [Int](repeating: -1, count: n)
        for j in 0..<own.count {
            guard let x = awcChartDatumX(own[j]), let at = indexOf[keyOf(x)] else { continue }
            row[at] = awcChartDatumY(own[j]); fwd[j] = at; back[at] = j
        }
        data.append(row); toMerged.append(fwd); toOwn.append(back)
    }
    return AWCChartNormalizedX(xValues: xValues, data: data, toMerged: toMerged, toOwn: toOwn, hasPointX: true)
}

/// xy.ts `normalizeRange`.
func awcChartNormalizeRange(_ d: AWCValue) -> (Double, Double)? {
    var lo: Double?, hi: Double?
    switch d {
    case .array(let a): lo = a.count > 0 ? a[0].number : nil; hi = a.count > 1 ? a[1].number : nil
    case .object(let o): lo = o["low"]?.number; hi = o["high"]?.number
    default: return nil
    }
    guard let l = lo, let h = hi, l.isFinite, h.isFinite else { return nil }
    return (Swift.min(l, h), Swift.max(l, h))
}

func awcChartIndexRecord(_ v: AWCValue?) -> [Int: String]? {
    guard let v, case .object(let o) = v else { return nil }
    var out: [Int: String] = [:]
    for (k, val) in o { if let i = Int(k) { out[i] = val.string } }
    return out
}

func awcChartAxisBands(_ tokens: [String: String], _ v: AWCValue?) -> [AWCChartAxisBandSpec]? {
    guard let v else { return nil }
    let arr = v.array
    if arr.isEmpty { return nil }
    return arr.map { b in
        AWCChartAxisBandSpec(from: awcChartAxisValue(b["from"]) ?? .number(.nan), to: awcChartAxisValue(b["to"]) ?? .number(.nan),
                             color: b["color"] == .null ? nil : awcChartResolveSeriesColor(tokens, b["color"].string, b["color"].string),
                             label: b["label"] == .null ? nil : b["label"].string, labelAlign: b["labelAlign"] == .null ? nil : b["labelAlign"].string,
                             labelColor: b["labelColor"] == .null ? nil : awcChartResolveSeriesColor(tokens, b["labelColor"].string, b["labelColor"].string))
    }
}

func awcChartBreaks(_ v: AWCValue?) -> AWCChartAxisBreaks? {
    guard let v else { return nil }
    func ranges(_ a: [AWCValue]) -> [(from: AWCChartAxisValue, to: AWCChartAxisValue, gap: Double?)] {
        a.map { (awcChartAxisValue($0["from"]) ?? .number(.nan), awcChartAxisValue($0["to"]) ?? .number(.nan), $0["gap"].number) }
    }
    switch v {
    case .string(let s) where s == "auto": return AWCChartAxisBreaks(auto: true)
    case .array(let a): return AWCChartAxisBreaks(ranges: ranges(a))
    case .object(let o):
        return AWCChartAxisBreaks(ranges: ranges(o["ranges"]?.array ?? []), auto: o["auto"]?.bool ?? false, minGap: o["minGap"]?.number,
                                  maxBreaks: o["maxBreaks"]?.number.map { Int($0) }, gap: o["gap"]?.number, sizing: o["sizing"].flatMap { AWCChartBreakSizing(rawValue: $0.string) })
    default: return nil
    }
}

/// Typed property access with the Web defaults (attribute strings coerce like Stencil props).
struct AWCChartProps {
    let p: [String: AWCValue]
    init(_ p: [String: AWCValue]) { self.p = p }
    func str(_ k: String, _ d: String) -> String { guard let v = p[k], v != .null else { return d }; return v.string }
    func optStr(_ k: String) -> String? { guard let v = p[k], v != .null else { return nil }; return v.string }
    func bool(_ k: String, _ d: Bool = false) -> Bool {
        guard let v = p[k], v != .null else { return d }
        if case .string(let s) = v { return s != "false" }
        return v.bool ?? d
    }
    func num(_ k: String) -> Double? { guard let v = p[k], v != .null else { return nil }; if case .string(let s) = v { let n = awcJSNumber(s); return n.isNaN ? nil : n }; return v.number }
    func num(_ k: String, _ d: Double) -> Double { num(k) ?? d }
    func obj(_ k: String) -> AWCValue? { guard let v = p[k], v != .null else { return nil }; if case .string(let s) = v, let data = s.data(using: .utf8), let parsed = try? JSONDecoder().decode(AWCValue.self, from: data) { return parsed }; return v }
}

func awcChartDensity(_ props: AWCChartProps, inherited: Double) -> Double { AWCNativeDensity.resolve(props.num("density"), inherited: inherited) }

/// The cartesian (line / area) spec, matching each component's `buildSpec`.
struct AWCChartCartesianInput {
    var tag: String
    var props: AWCChartProps
    var tokens: [String: String]
    var density: Double
    var formatters = AWCChartFormatters()
    var zoomWindow: (start: Int, end: Int)? = nil
    var legendHidden: [String: Bool] = [:]
    /// The engine's own legend self-toggle (chart.ts onLegendToggle), which outranks `hidden` until the next spec rebuild.
    var hiddenOverride: [Int: Bool] = [:]
}

func awcChartSeriesKeys(_ series: [AWCValue]) -> [String] {
    var seen: [String: Int] = [:]
    return series.enumerated().map { i, s in
        let base = s["id"] != .null ? "id:\(s["id"].string)" : s["label"] != .null ? "label:\(s["label"].string)" : "pos:\(i)"
        let n = seen[base] ?? 0; seen[base] = n + 1
        return n == 0 ? base : "\(base)#\(n)"
    }
}

func awcChartLocaleNumber(_ v: Double, _ locale: String) -> String { AWCChartIntl.number(v, locale) }

func awcChartBuildCartesianSpec(_ input: AWCChartCartesianInput, theme t: AWCChartTheme) -> AWCChartLineSpec {
    let pr = input.props
    let isArea = input.tag == "md-area-chart"
    let stack = pr.str("stack", isArea ? "normal" : "none")
    let percentage = stack == "percentage"
    let locale = pr.str("locale", "")
    let vf = input.formatters.valueFormatter
    let yFmt: (Double) -> String = { v in vf != nil ? vf!(v) : awcChartLocaleNumber(v, locale) }
    let seriesValues = pr.obj("series")?.array ?? []
    let xAxis = pr.obj("xAxis"), yAxis = pr.obj("yAxis")
    let scale = xAxis.flatMap { AWCChartScaleType(rawValue: $0["scale"].string) } ?? .category
    let axisData: [AWCChartAxisValue]? = xAxis.flatMap { $0["data"] == .null ? nil : $0["data"].array.compactMap(awcChartAxisValue) }
    let keys = awcChartSeriesKeys(seriesValues)
    let zw = input.zoomWindow
    func cut<T>(_ a: [T]) -> [T] { guard let zw else { return a }; let lo = Swift.min(zw.start, a.count), hi = Swift.min(zw.end + 1, a.count); return lo < hi ? Array(a[lo..<hi]) : [] }
    func rebase(_ rec: [Int: String]?) -> [Int: String]? {
        guard let rec, let zw else { return rec }
        var out: [Int: String] = [:]
        for (k, v) in rec { let i = k - zw.start; if i >= 0 && i <= zw.end - zw.start { out[i] = v } }
        return out
    }
    let showLine = pr.bool("showLine", true)
    var series: [AWCChartLineSeriesSpec] = []
    var xValues: [AWCChartAxisValue]
    if isArea {
        xValues = cut(axisData ?? [])
        for (i, s) in seriesValues.enumerated() {
            let rangeRaw = s["range"] == .null ? nil : s["range"].array
            let data: [AWCChartCell] = rangeRaw != nil ? rangeRaw!.map { _ in .null } : s["data"].array.map { if case .number(let n) = $0 { return .num(n) }; return .null }
            var spec = AWCChartLineSeriesSpec(label: s["label"] == .null ? "Series \(i + 1)" : s["label"].string,
                                              color: awcChartResolveSeriesColor(input.tokens, s["color"] == .null ? nil : s["color"].string, awcChartPickPaletteColor(t.palette, i)),
                                              data: cut(data))
            if let rr = rangeRaw { spec.range = cut(rr.map(awcChartNormalizeRange)) }
            spec.fill = s["fill"].bool
            spec.stroke = s["stroke"].bool ?? (!showLine || stack == "wiggle" || stack == "silhouette" ? false : nil)
            spec.curve = s["curve"] == .null ? pr.str("curve", "smooth") : s["curve"].string
            spec.connectNulls = s["connectNulls"].bool ?? pr.bool("connectNulls")
            spec.showMarks = s["showMarks"].bool ?? pr.bool("showMarks")
            spec.hidden = input.hiddenOverride[i] ?? s["hidden"].bool ?? input.legendHidden[keys[i]] ?? false
            spec.dash = s["dash"] == .null ? nil : s["dash"].string
            spec.symbol = s["symbol"] == .null ? nil : s["symbol"].string
            spec.pointSymbols = rebase(awcChartIndexRecord(s["pointSymbols"]))
            spec.lineWidth = s["lineWidth"].number ?? pr.num("lineWidth")
            spec.markSize = s["markSize"].number ?? pr.num("markSize")
            series.append(spec)
        }
    } else {
        let m = awcChartNormalizeSeriesX(seriesValues.map { $0["data"].array }, axisData, scale)
        xValues = cut(m.xValues)
        for (i, s) in seriesValues.enumerated() {
            let toMerged = m.toMerged[i]
            let dashAfterRaw = s["dashAfter"].number.map { Int($0) }
            let dashAt: Int? = dashAfterRaw != nil && toMerged != nil ? (dashAfterRaw! >= 0 && dashAfterRaw! < toMerged!.count ? toMerged![dashAfterRaw!] : nil) : dashAfterRaw
            var pointSymbols = awcChartIndexRecord(s["pointSymbols"])
            if let ps = pointSymbols, let tm = toMerged { var out: [Int: String] = [:]; for (k, v) in ps where k >= 0 && k < tm.count && tm[k] >= 0 { out[tm[k]] = v }; pointSymbols = out }
            var spec = AWCChartLineSeriesSpec(label: s["label"] == .null ? "Series \(i + 1)" : s["label"].string,
                                              color: awcChartResolveSeriesColor(input.tokens, s["color"] == .null ? nil : s["color"].string, awcChartPickPaletteColor(t.palette, i)),
                                              data: input.zoomWindow != nil ? cut(m.data[i]) : m.data[i])
            spec.curve = s["curve"] == .null ? pr.str("curve", "smooth") : s["curve"].string
            spec.connectNulls = s["connectNulls"].bool ?? pr.bool("connectNulls")
            spec.showMarks = s["showMarks"].bool ?? pr.bool("showMarks")
            spec.hidden = input.hiddenOverride[i] ?? s["hidden"].bool ?? input.legendHidden[keys[i]] ?? false
            spec.dash = s["dash"] == .null ? nil : s["dash"].string
            spec.symbol = s["symbol"] == .null ? nil : s["symbol"].string
            spec.pointSymbols = rebase(pointSymbols)
            spec.yAxisIndex = s["yAxisIndex"].number.map { Int($0) }
            spec.dashAfter = dashAt != nil && dashAt! >= 0 && zw != nil ? dashAt! - zw!.start : dashAt
            spec.hollow = s["hollow"].bool
            spec.stroke = s["stroke"].bool ?? (showLine ? nil : false)
            spec.lineWidth = s["lineWidth"].number ?? pr.num("lineWidth")
            spec.markSize = s["markSize"].number ?? pr.num("markSize")
            series.append(spec)
        }
    }
    let grid = pr.str("grid", "horizontal")
    var spec = AWCChartLineSpec(series: series)
    let label = pr.str("label", "")
    spec.title = label.isEmpty ? nil : label
    let subtitle = pr.str("subtitle", "")
    spec.subtitle = subtitle.isEmpty ? nil : subtitle
    spec.titleAlign = pr.str("titleAlign", "start")
    spec.xValues = xValues
    spec.xScale = scale
    let xf = input.formatters.xAxisFormatter
    spec.xFormatter = { v in xf != nil ? xf!(v) : awcChartDefaultValueFormatter(v, locale) }
    spec.xLabel = xAxis?["label"] == .null ? nil : xAxis?["label"].string
    spec.xHidden = xAxis?["hidden"].bool
    spec.xHideTicks = xAxis?["hideTicks"].bool
    spec.xDash = xAxis.flatMap { $0["dash"] == .null ? nil : $0["dash"].string }
    spec.xGridDash = xAxis.flatMap { $0["gridDash"] == .null ? nil : $0["gridDash"].string }
    spec.xBands = awcChartAxisBands(input.tokens, xAxis?["bands"])
    spec.yBands = awcChartAxisBands(input.tokens, yAxis?["bands"])
    spec.xBreaks = awcChartBreaks(xAxis?["breaks"] == .null ? nil : xAxis?["breaks"])
    spec.yBreaks = awcChartBreaks(yAxis?["breaks"] == .null ? nil : yAxis?["breaks"])
    spec.yScale = yAxis.flatMap { AWCChartScaleType(rawValue: $0["scale"].string) } ?? .value
    spec.yMin = percentage ? 0 : yAxis?["min"].number
    spec.yMax = percentage ? 100 : yAxis?["max"].number
    spec.yFormatter = percentage ? { v in "\(Int(awcJSRound(v)))%" } : yFmt
    if !percentage, let yf = input.formatters.yAxisFormatter { spec.yTickFormatter = yf }
    spec.yLabel = yAxis?["label"] == .null ? nil : yAxis?["label"].string
    spec.yHidden = yAxis?["hidden"].bool
    spec.yHideTicks = yAxis?["hideTicks"].bool
    spec.yDash = yAxis.flatMap { $0["dash"] == .null ? nil : $0["dash"].string }
    spec.yGridDash = yAxis.flatMap { $0["gridDash"] == .null ? nil : $0["gridDash"].string }
    spec.stack = stack
    spec.legend = pr.str("legend", "top-end")
    spec.gridY = grid == "horizontal" || grid == "both"
    spec.gridX = grid == "vertical" || grid == "both"
    spec.axisTicks = pr.bool("axisTicks")
    spec.inverted = pr.bool("inverted")
    spec.showLabels = pr.bool("showLabels")
    spec.seriesLabels = pr.bool("seriesLabels")
    spec.animation = pr.bool("noAnimation") ? "none" : pr.str("animation", "expressive")
    spec.animationDuration = pr.num("animationDuration")
    if isArea {
        spec.area = true
        spec.fillOpacity = pr.num("fillOpacity", 0.55)
    } else {
        spec.area = pr.bool("area")
        let yAxes = pr.obj("yAxes")?.array ?? []
        if !yAxes.isEmpty {
            spec.yAxes = yAxes.enumerated().map { ai, a in
                let f = input.formatters.yAxesFormatters[ai]
                return AWCChartValueAxisSpec(scale: AWCChartScaleType(rawValue: a["scale"].string) ?? .value, min: a["min"].number, max: a["max"].number,
                                             formatter: { v in f != nil ? f!(v) : awcChartLocaleNumber(v, locale) },
                                             label: a["label"] == .null ? nil : a["label"].string, position: a["position"] == .null ? nil : a["position"].string,
                                             hidden: a["hidden"].bool, hideTicks: a["hideTicks"].bool,
                                             color: a["color"] == .null ? nil : awcChartResolveSeriesColor(input.tokens, a["color"].string, a["color"].string),
                                             bands: awcChartAxisBands(input.tokens, a["bands"]), dash: a["dash"] == .null ? nil : a["dash"].string,
                                             gridDash: a["gridDash"] == .null ? nil : a["gridDash"].string)
            }
        }
        let markLines = pr.obj("markLines")?.array
        if let markLines {
            let categoryAxis = scale == .category
            spec.markLines = markLines.compactMap { ml in
                guard var value = awcChartAxisValue(ml["value"]) else { return nil }
                var offscreen = false
                if let zw, categoryAxis, case .number(let n) = value {
                    value = .number(n - Double(zw.start))
                    let nv = n - Double(zw.start)
                    offscreen = nv < 0 || nv > Double(zw.end - zw.start)
                }
                if offscreen { return nil }
                return AWCChartMarkLineSpec(value: value, label: ml["label"] == .null ? nil : ml["label"].string,
                                            color: ml["color"] == .null ? nil : awcChartResolveSeriesColor(input.tokens, ml["color"].string, ml["color"].string),
                                            dash: ml["dash"] == .null ? nil : ml["dash"].string)
            }
        }
    }
    return spec
}

// MARK: Legend measurement (overlay.ts syncOverlay chips) and the chart.ts render pass

struct AWCChartTextMetrics {
    /// Width of `text` in the chart font (Roboto, CSS weight matching against 400/500/700).
    static func width(_ text: String, size: Double, weight: Double = 400) -> Double {
        let font = awcChartCTFont(size: size, weight: weight)
        let attr = NSAttributedString(string: text, attributes: [NSAttributedString.Key(kCTFontAttributeName as String): font])
        let line = CTLineCreateWithAttributedString(attr)
        return CTLineGetTypographicBounds(line, nil, nil, nil)
    }
    /// CSS `line-height: normal` for the chart font.
    static func normalLineHeight(size: Double, weight: Double = 400) -> Double {
        let f = awcChartCTFont(size: size, weight: weight)
        return CTFontGetAscent(f) + CTFontGetDescent(f) + CTFontGetLeading(f)
    }
}

/// CSS font matching with Roboto 400/500/700 installed (what the reference pages load).
func awcChartFontName(weight: Double) -> String {
    if weight > 500 { return "Roboto-Bold" }
    if weight > 400 { return "Roboto-Medium" }
    return "Roboto-Regular"
}

func awcChartCTFont(size: Double, weight: Double) -> CTFont {
    _ = AWCNativeFonts.labelFamily(regular: true) // registers the bundled Roboto files
    return CTFontCreateWithName(awcChartFontName(weight: weight) as CFString, size, nil)
}

/// The legend nav's measured extent: offsetHeight of the wrapped chip rows (top/bottom), or
/// offsetWidth of the chip column (left/right).
func awcChartLegendExtent(_ scene: AWCChartScene) -> Double? {
    let items = scene.legend
    guard items.count > 1 else { return nil }
    let pos = scene.legendPosition ?? "top-end"
    let isSide = pos == "left" || pos == "right"
    let fontSize = scene.texts.first?.fontSize ?? 11
    let lineH = AWCChartTextMetrics.normalLineHeight(size: fontSize)
    let chipH = Swift.max(10, lineH) + 4
    let chipWidths = items.map { 4 + 10 + 6 + AWCChartTextMetrics.width($0.label, size: fontSize) + 4 }
    if isSide {
        let maxW = AWC_LEGEND_SIDE_MAX_FRACTION * scene.width
        let content = (chipWidths.max() ?? 0) + 12
        return awcJSRound(Swift.min(maxW, content))
    }
    let corner = pos.contains("-")
    let avail = corner ? scene.width * 0.88 : scene.width - 24
    var rows = 1, rowW = 0.0
    for w in chipWidths {
        let cw = Swift.min(w, avail)
        if rowW > 0 && rowW + 12 + cw > avail + 0.001 { rows += 1; rowW = cw } else { rowW += (rowW > 0 ? 12 : 0) + cw }
    }
    return awcJSRound(Double(rows) * chipH + Double(rows - 1) * 4)
}

/// rtl.ts `mirrorScene`.
func awcChartMirrorScene(_ s: AWCChartScene) -> AWCChartScene {
    let W = s.width
    func mx(_ x: Double) -> Double { W - x }
    func mPts(_ p: [AWCChartPt]) -> [AWCChartPt] { p.map { AWCChartPt(x: mx($0.x), y: $0.y) } }
    func mSeg(_ g: AWCChartSegment) -> AWCChartSegment { var o = g; o.x1 = mx(g.x1); o.x2 = mx(g.x2); return o }
    var o = s
    o.plot.x = mx(s.plot.x + s.plot.width)
    o.bands = s.bands?.map { var b = $0; b.x = mx($0.x + $0.w); return b }
    o.gridlines = s.gridlines.map(mSeg)
    o.axisLines = s.axisLines.map(mSeg)
    o.areas = s.areas.map { var a = $0; a.points = mPts($0.points); a.basePoints = $0.basePoints.map(mPts); return a }
    o.bars = s.bars.map { var b = $0; b.x = mx($0.x + $0.w); b.radius = [$0.radius[1], $0.radius[0], $0.radius[3], $0.radius[2]]; return b }
    if let bb = s.barBaseline, s.bars.first?.horizontal == true { o.barBaseline = mx(bb) }
    o.slices = s.slices.map { var c = $0; c.cx = mx($0.cx); c.startAngle = Double.pi - $0.endAngle; c.endAngle = Double.pi - $0.startAngle; return c }
    o.lines = s.lines.map { var l = $0; l.points = mPts($0.points); return l }
    o.markers = s.markers.map { var m = $0; m.x = mx($0.x); return m }
    o.glyphs = s.glyphs?.map { var g = $0; g.x = mx($0.x); return g }
    o.endLabels = s.endLabels?.map { var e = $0; e.x = mx($0.x); e.side = $0.side == "end" ? "start" : "end"; return e }
    o.texts = s.texts.map { var t = $0; t.x = mx($0.x); t.align = $0.align == "start" ? "end" : $0.align == "end" ? "start" : "center"; if let r = $0.rotate, r != 0 { t.rotate = -r }; return t }
    o.legend = s.legend.map { var l = $0; l.x = mx($0.x); return l }
    o.xPositions = s.xPositions.map(mx)
    o.hoverPoints = s.hoverPoints.map { var h = $0; h.byIndex = $0.byIndex.mapValues { var p = $0; p.x = mx($0.x); return p }; return h }
    return o
}

/// chart.ts `render()`: layout, then the RTL mirror. The line/area engine's measured-legend second pass
/// looks for the legend inside the text overlay, but the legend lives in its own layer, so on the Web it
/// never runs and layout keeps the estimated legend band; `measuredLegend` is only true for the bar
/// engine, whose pass queries the legend layer and does apply.
func awcChartRenderScene(_ spec: inout AWCChartLineSpec, _ theme: AWCChartEngineTheme, width: Double, height: Double, rtl: Bool, measuredLegend: Bool = false) -> AWCChartScene {
    func layout() -> AWCChartScene { let s = awcChartComputeLayout(spec, theme, width, height); return rtl ? awcChartMirrorScene(s) : s }
    var scene = layout()
    if measuredLegend, let legend = spec.legend, legend != "none", let extent = awcChartLegendExtent(scene), extent > 0, abs((spec.legendExtent ?? -1) - extent) > 2 {
        spec.legendExtent = extent
        scene = layout()
    }
    return scene
}
