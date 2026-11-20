import SwiftUI
import Accessibility

// The chart's data for assistive technologies. The Web component renders a visually hidden data table (a11y.ts
// `buildDataTable`: one row per category, one column per series; pie: one row per slice). The native equivalent on
// macOS and iOS is the chart descriptor VoiceOver offers as chart details and Audio Graphs: the same categories, series
// and values, attached to the plot element.

/// The descriptor's content: title, summary, the category axis, and the series (nil = no value at that category).
struct AWCChartAXDescriptor: AXChartDescriptorRepresentable, Equatable {
    var title: String
    var summary: String
    var categories: [String]
    var series: [AWCChartAXSeries]
    var continuous: Bool
    /// The table's column titles (`tableLabels`): the category column (x / index; pie: category) and the values (pie: value).
    var xTitle = "Category", yTitle = "Value"
    /// Pie: each slice's share of its ring (the table's share column, `tableLabels.share`), an additional axis in percent.
    var shares: [Double?]? = nil, shareTitle = "Share"

    func makeChartDescriptor() -> AXChartDescriptor {
        let values = series.flatMap { $0.values.compactMap { $0 } }
        let lo = Swift.min(0, values.min() ?? 0), hi = Swift.max(values.max() ?? 1, lo + 1)
        let x = AXCategoricalDataAxisDescriptor(title: xTitle, categoryOrder: categories)
        let y = AXNumericDataAxisDescriptor(title: yTitle, range: lo...hi, gridlinePositions: []) { awcJSNumberString($0) }
        let share = shares.map { _ in AXNumericDataAxisDescriptor(title: shareTitle, range: 0...100, gridlinePositions: []) { awcChartAXPercent($0) } }
        let s = series.map { item in
            AXDataSeriesDescriptor(name: item.name, isContinuous: continuous, dataPoints: item.values.enumerated().compactMap { i, v in
                v.map { AXDataPoint(x: i < categories.count ? categories[i] : String(i + 1), y: $0,
                                    additionalValues: (shares.flatMap { i < $0.count ? $0[i] : nil }).map { [AXDataPoint.Value.number($0)] } ?? []) }
            })
        }
        return AXChartDescriptor(title: title, summary: summary, xAxis: x, yAxis: y, additionalAxes: share.map { [$0 as any AXDataAxisDescriptor] } ?? [], series: s)
    }
}

struct AWCChartAXSeries: Equatable {
    var name: String
    var values: [Double?]
}

/// A datum's value: a number, `{ y }` / `{ value }`, or `[x, y]`; null and anything else is no value.
private func awcChartAXValue(_ d: AWCValue) -> Double? {
    switch d {
    case .number(let n): return n.isFinite ? n : nil
    case .object: return d["y"].number ?? d["value"].number
    case .array(let a): return a.count > 1 ? a[1].number : nil
    default: return nil
    }
}

/// A share as the table prints it: one decimal at most, trailing .0 dropped ("40%", "12.5%").
func awcChartAXPercent(_ v: Double) -> String { awcJSNumberString((v * 10).rounded() / 10) + "%" }

/// `tableLabels` (md-line / md-area / md-bar: x, index, series; md-pie: category, value, share): a non-empty string field.
private func awcChartAXTableLabel(_ props: AWCChartProps, _ key: String) -> String? {
    guard let o = props.obj("tableLabels"), case .string(let s) = o[key], !s.isEmpty else { return nil }
    return s
}

private func awcChartAXLabel(_ d: AWCValue, _ i: Int) -> String {
    switch d {
    case .string(let s): return s
    case .number(let n): return awcJSNumberString(n)
    case .object:
        for key in ["label", "name", "x"] { let v = d[key]; if case .string(let s) = v { return s }; if case .number(let n) = v { return awcJSNumberString(n) } }
        return String(i + 1)
    default: return String(i + 1)
    }
}

/// The descriptor for a chart's current properties (nil for the sparkline: an image, as on the Web).
func awcChartAXDescriptor(kind: AWCChartKind, props: AWCChartProps, summary: String) -> AWCChartAXDescriptor? {
    let title = props.str("label", "")
    switch kind {
    case .sparkline: return nil
    case .pie:
        let data = props.obj("data")?.array ?? []
        guard !data.isEmpty else { return nil }
        let names = data.enumerated().map { awcChartAXLabel($0.element, $0.offset) }
        // a11y.ts buildDataTable for the pie (md-pie-chart.tsx rebuildA11yTable): category, value and share columns, titled by
        // `tableLabels` (Category / Value / Share).
        let values = data.map(awcChartAXValue), total = values.compactMap { $0 }.reduce(0, +)
        let value = awcChartAXTableLabel(props, "value") ?? "Value"
        return AWCChartAXDescriptor(title: title, summary: summary, categories: names, series: [AWCChartAXSeries(name: value, values: values)], continuous: false,
                                    xTitle: awcChartAXTableLabel(props, "category") ?? "Category", yTitle: value,
                                    shares: values.map { v in v.map { total > 0 ? $0 / total * 100 : 0 } }, shareTitle: awcChartAXTableLabel(props, "share") ?? "Share")
    default:
        let series = props.obj("series")?.array ?? []
        let axis = props.obj("xAxis")?["data"].array ?? []
        // Without series the Web table still lists the categories (a11y.ts buildDataTable), so the descriptor does too.
        guard !series.isEmpty || !axis.isEmpty else { return nil }
        let length = Swift.max(axis.count, series.map { $0["data"].array.count }.max() ?? 0)
        let categories = (0..<length).map { i in i < axis.count ? awcChartAXLabel(axis[i], i) : String(i + 1) }
        // The category column: the x axis's label, else `tableLabels.x` (category data) / `tableLabels.index` (no x data); an
        // unlabelled series takes `tableLabels.series` (a11y.ts buildDataTable: X / # / Series).
        // md-bar-chart has no `tableLabels` (its table keeps the defaults).
        func label(_ k: String) -> String? { kind == .bar ? nil : awcChartAXTableLabel(props, k) }
        let xLabel = props.obj("xAxis").flatMap { o -> String? in if case .string(let t) = o["label"], !t.isEmpty { return t }; return nil }
        let xTitle = xLabel ?? (axis.isEmpty ? label("index") ?? "#" : label("x") ?? "X")
        let seriesFallback = label("series") ?? "Series"
        let items = series.enumerated().map { i, s -> AWCChartAXSeries in
            let name = [s["label"], s["name"]].compactMap { v -> String? in if case .string(let t) = v, !t.isEmpty { return t }; return nil }.first ?? seriesFallback
            let data = s["data"].array
            return AWCChartAXSeries(name: name, values: (0..<length).map { $0 < data.count ? awcChartAXValue(data[$0]) : nil })
        }
        return AWCChartAXDescriptor(title: title, summary: summary, categories: categories, series: items, continuous: kind != .bar, xTitle: xTitle)
    }
}
