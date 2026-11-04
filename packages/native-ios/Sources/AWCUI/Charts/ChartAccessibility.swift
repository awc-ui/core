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

    func makeChartDescriptor() -> AXChartDescriptor {
        let values = series.flatMap { $0.values.compactMap { $0 } }
        let lo = Swift.min(0, values.min() ?? 0), hi = Swift.max(values.max() ?? 1, lo + 1)
        let x = AXCategoricalDataAxisDescriptor(title: "Category", categoryOrder: categories)
        let y = AXNumericDataAxisDescriptor(title: "Value", range: lo...hi, gridlinePositions: []) { awcJSNumberString($0) }
        let s = series.map { item in
            AXDataSeriesDescriptor(name: item.name, isContinuous: continuous, dataPoints: item.values.enumerated().compactMap { i, v in
                v.map { AXDataPoint(x: i < categories.count ? categories[i] : String(i + 1), y: $0) }
            })
        }
        return AXChartDescriptor(title: title, summary: summary, xAxis: x, yAxis: y, additionalAxes: [], series: s)
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
        return AWCChartAXDescriptor(title: title, summary: summary, categories: names,
                                    series: [AWCChartAXSeries(name: title.isEmpty ? "Value" : title, values: data.map(awcChartAXValue))], continuous: false)
    default:
        let series = props.obj("series")?.array ?? []
        guard !series.isEmpty else { return nil }
        let axis = props.obj("xAxis")?["data"].array ?? []
        let length = Swift.max(axis.count, series.map { $0["data"].array.count }.max() ?? 0)
        let categories = (0..<length).map { i in i < axis.count ? awcChartAXLabel(axis[i], i) : String(i + 1) }
        let items = series.enumerated().map { i, s -> AWCChartAXSeries in
            let name = [s["label"], s["name"]].compactMap { v -> String? in if case .string(let t) = v, !t.isEmpty { return t }; return nil }.first ?? "Series \(i + 1)"
            let data = s["data"].array
            return AWCChartAXSeries(name: name, values: (0..<length).map { $0 < data.count ? awcChartAXValue(data[$0]) : nil })
        }
        return AWCChartAXDescriptor(title: title, summary: summary, categories: categories, series: items, continuous: kind != .bar)
    }
}
