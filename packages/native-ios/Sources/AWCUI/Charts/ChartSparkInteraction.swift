import Foundation

// md-sparkline's interaction: the line engine (line / area) or the bar engine (bar) with only the hover card
// (`show-tooltip`) and the point click — no keyboard, legend or zoom. A variant swap disposes the engine, so the
// controller is rebuilt and its hover state starts fresh. Lockstep port of ChartSparkInteraction.kt.

final class AWCChartSparkInteraction {
    var data: [AWCValue] = []
    var showTooltip = true
    var rtl = false
    var reducedMotion = false
    var onEvent: (AWCChartEvent) -> Void = { _ in }
    var now: () -> Double = { ProcessInfo.processInfo.systemUptime * 1000 }
    /// Rebuild `scene` of the plot controller for the current props and size.
    var rebuild: (AWCChartPlotInteraction) -> Void = { _ in }
    private(set) var variant = "line"
    private(set) var plot: AWCChartPlotInteraction? = nil

    /// Any property change: md-sparkline applyEngine (a variant change swaps the engine first).
    func applyEngine(variant: String) {
        let bar = variant == "bar"
        if plot == nil || bar != (plot is AWCChartBarInteraction) {
            plot = bar ? AWCChartBarInteraction() : AWCChartCartesianInteraction(isArea: false)
        }
        self.variant = variant
        let series: [AWCValue] = [.object(["data": .array(data)])]
        let values = data
        let forward: (AWCChartEvent) -> Void = { [weak self] e in
            guard e.name == "mdMarkerClick" || e.name == "mdBarClick", let di = e.detail["dataIndex"] as? Int else { return }
            let v: Double? = di >= 0 && di < values.count ? values[di].number : nil
            self?.onEvent(AWCChartEvent(name: "mdSparkClick", detail: ["dataIndex": di, "value": v]))
        }
        if let p = plot as? AWCChartCartesianInteraction { p.series = series; p.tooltip = showTooltip ? "axis" : "none"; p.missingFormatter = nil; p.onEvent = forward }
        if let p = plot as? AWCChartBarInteraction { p.series = series; p.tooltip = showTooltip ? "axis" : "none"; p.missingFormatter = nil; p.onEvent = forward }
        guard let p = plot else { return }
        p.rtl = rtl; p.reducedMotion = reducedMotion; p.now = now
        p.rebuild = { [weak self, weak p] in if let self, let p { self.rebuild(p) } }
        p.applyEngine()
    }
}
