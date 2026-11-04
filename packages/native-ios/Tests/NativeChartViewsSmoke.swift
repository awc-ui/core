import SwiftUI
import AppKit
import Accessibility
@testable import AWCUI

// Renders the dedicated SwiftUI chart views (md-line/area/bar/pie-chart, md-sparkline) through AWCNativeView's dispatch
// with ImageRenderer at 1x, light and dark, LTR and RTL, and writes PNGs + a manifest — runtime evidence that the
// views build, lay out at the model's sizes and draw (the geometry itself is verified by the integration suites).
// Usage: NativeChartViewsSmoke <out dir>

@main enum NativeChartViewsSmoke {
    @MainActor static func render(_ name: String, _ tag: String, _ props: [String: AWCValue], children: [AWCNode] = [], dark: Bool, rtl: Bool, width: CGFloat, out: URL) -> String {
        let node = AWCNode(tag: tag, properties: props, children: children)
        let view = AWCNativeView(node: node)
            .environment(\.layoutDirection, rtl ? .rightToLeft : .leftToRight)
            .environment(\.colorScheme, dark ? .dark : .light)
            .awcTheme(.generated(dark: dark))
            .frame(width: width, alignment: .topLeading)
            .padding(8)
            .background(dark ? Color(awcHex: "#1C1B1F") : Color(awcHex: "#FFFBFE"))
        let r = ImageRenderer(content: view)
        r.scale = 1
        guard let img = r.nsImage, let tiff = img.tiffRepresentation, let rep = NSBitmapImageRep(data: tiff), let png = rep.representation(using: .png, properties: [:]) else {
            return "\(name): RENDER FAILED"
        }
        let file = out.appendingPathComponent("\(name).png")
        try? png.write(to: file)
        return "\(name): \(Int(img.size.width))x\(Int(img.size.height))"
    }

    /// The plot focus bridge hosted in a window (AppKit key-view loop): one key view, a labelled group with the chart
    /// descriptor, increment steps the cursor, and Tab goes from the plot to the first legend chip (Web: application → button).
    @MainActor static func hosted(_ name: String, _ tag: String, _ props: [String: AWCValue], firstChip: String, series: Int) -> String {
        _ = NSApplication.shared
        let host = NSHostingView(rootView: AWCNativeView(node: AWCNode(tag: tag, properties: props, children: []))
            .awcTheme(.generated(dark: false)).frame(width: 480, alignment: .topLeading))
        let window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 480, height: 320), styleMask: [.titled], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false
        window.contentView = host
        window.autorecalculatesKeyViewLoop = true
        RunLoop.current.run(until: Date().addingTimeInterval(0.5)); host.layoutSubtreeIfNeeded()
        var plots: [AWCChartPlotFocusView] = []
        func walk(_ v: NSView) { if let p = v as? AWCChartPlotFocusView { plots.append(p) }; v.subviews.forEach(walk) }
        walk(host)
        guard plots.count == 1, let plot = plots.first else { return "\(name): FAILED (\(plots.count) plot focus views)" }
        var problems: [String] = []
        if !plot.canBecomeKeyView { problems.append("not a key view") }
        if plot.accessibilityRole() != .group || !(plot.accessibilityLabel() ?? "").hasPrefix("Chart data") { problems.append("role / label") }
        if plot.accessibilityChartDescriptor?.series.count != series { problems.append("descriptor") }
        if !window.makeFirstResponder(plot) { problems.append("first responder") }
        _ = plot.accessibilityPerformIncrement(); RunLoop.current.run(until: Date().addingTimeInterval(0.3))
        let value = plot.accessibilityValue() as? String ?? ""
        if value.isEmpty { problems.append("increment left no cursor value") }
        window.recalculateKeyViewLoop()
        window.selectNextKeyView(nil); RunLoop.current.run(until: Date().addingTimeInterval(0.1))
        let next = (window.firstResponder as? NSView)?.accessibilityLabel() ?? String(describing: window.firstResponder)
        if next != firstChip { problems.append("Tab → \(next)") }
        window.close()
        return "\(name): " + (problems.isEmpty ? "key view, group, descriptor \(series) series, increment → \"\(value)\", Tab → \(next)" : "FAILED " + problems.joined(separator: ", "))
    }

    @MainActor static func main() {
        let out = URL(fileURLWithPath: CommandLine.arguments.dropFirst().first ?? "chart-views-smoke")
        try? FileManager.default.createDirectory(at: out, withIntermediateDirectories: true)
        var lines: [String] = []
        let series: AWCValue = .array([
            .object(["label": "Revenue", "data": .array([12, 18, 15, 22, 28, 26].map { AWCValue.number($0) })]),
            .object(["label": "Cost", "data": .array([8, 11, 10, 14, 16, 18].map { AWCValue.number($0) })]),
        ])
        let xAxis: AWCValue = .object(["data": .array(["Jan", "Feb", "Mar", "Apr", "May", "Jun"].map { AWCValue.string($0) })])
        let charts: [(String, String, [String: AWCValue])] = [
            ("chart-line", "md-line-chart", ["series": series, "xAxis": xAxis, "label": "Line", "height": "260px", "noAnimation": true]),
            ("chart-area", "md-area-chart", ["series": series, "xAxis": xAxis, "label": "Area", "height": "260px", "noAnimation": true]),
            ("chart-bar", "md-bar-chart", ["series": series, "xAxis": xAxis, "label": "Bar", "height": "260px", "noAnimation": true]),
            ("chart-pie", "md-pie-chart", ["data": .array([("A", 40), ("B", 25), ("C", 20), ("D", 15)].map { AWCValue.object(["label": .string($0.0), "value": .number(Double($0.1))]) }), "label": "Pie", "height": "260px", "noAnimation": true]),
            ("chart-sparkline", "md-sparkline", ["data": .array([3, 5, 4, 7, 6, 9, 8].map { AWCValue.number($0) }), "height": "32px", "noAnimation": true]),
        ]
        for dark in [false, true] {
            for rtl in [false, true] {
                let suffix = "\(dark ? "dark" : "light")-\(rtl ? "rtl" : "ltr")"
                for (n, t, p) in charts { lines.append(render("\(n)-\(suffix)", t, p, dark: dark, rtl: rtl, width: 480, out: out)) }
                // Slots: header + footer (in flow at the top, under the canvas) and the donut centre (on the ring centre).
                lines.append(render("chart-line-slots-\(suffix)", "md-line-chart", charts[0].2, children: [.text("Quarterly revenue", slot: "header"), .text("Source: finance", slot: "footer")], dark: dark, rtl: rtl, width: 480, out: out))
                var donut = charts[3].2; donut["innerRadius"] = "55%"
                lines.append(render("chart-pie-center-\(suffix)", "md-pie-chart", donut, children: [.text("100%", slot: "center")], dark: dark, rtl: rtl, width: 480, out: out))
            }
        }
        // The chart descriptor (VoiceOver chart details / Audio Graph; the Web's screen-reader data table): categories, series, values.
        for (n, t, p, want) in [("line", AWCChartKind.line, charts[0].2, (2, 6, 6)), ("bar", .bar, charts[2].2, (2, 6, 6)), ("pie", .pie, charts[3].2, (1, 4, 4))] {
            let d = awcChartAXDescriptor(kind: t, props: AWCChartProps(p), summary: "summary")?.makeChartDescriptor()
            let got = (d?.series.count ?? 0, d?.series.first?.dataPoints.count ?? 0, (d?.xAxis as? AXCategoricalDataAxisDescriptor)?.categoryOrder.count ?? 0)
            lines.append("descriptor-\(n): \(got.0) series, \(got.1) points, \(got.2) categories" + (got == want ? "" : " FAILED (want \(want))"))
        }
        lines.append("descriptor-sparkline: " + (awcChartAXDescriptor(kind: .sparkline, props: AWCChartProps(charts[4].2), summary: "") == nil ? "none (image)" : "FAILED"))
        lines.append(hosted("plot-focus-line", "md-line-chart", charts[0].2, firstChip: "Revenue", series: 2))
        lines.append(hosted("plot-focus-pie", "md-pie-chart", charts[3].2, firstChip: "A", series: 1))
        lines.forEach { print($0) }
        try? lines.joined(separator: "\n").write(to: out.appendingPathComponent("manifest.txt"), atomically: true, encoding: .utf8)
        let failed = lines.filter { $0.contains("FAILED") }.count
        print("NativeChartViewsSmoke: \(lines.count - failed)/\(lines.count) rendered")
        exit(failed == 0 ? 0 : 1)
    }
}
