package dev.awc.nativeui.charts

import dev.awc.nativeui.AWCValue

// md-sparkline's interaction: the line engine (line / area) or the bar engine (bar) with only the hover card
// (`show-tooltip`) and the point click — no keyboard, legend or zoom. A variant swap disposes the engine, so the
// controller is rebuilt and its hover state starts fresh.

class ChartSparkInteraction {
    var data: List<AWCValue> = emptyList()
    var showTooltip = true
    var rtl = false
    var reducedMotion = false
    var onEvent: (ChartEvent) -> Unit = {}
    var now: () -> Double = { System.nanoTime() / 1e6 }
    /** Rebuild `scene` of [plot] for the current props and size. */
    var rebuild: (ChartPlotInteraction) -> Unit = {}
    var variant = "line"; private set
    lateinit var plot: ChartPlotInteraction; private set
    val hasPlot get() = this::plot.isInitialized

    /** Any property change: md-sparkline applyEngine (a variant change swaps the engine first). */
    fun applyEngine(variant: String) {
        val kind = if (variant == "bar") "bar" else "line"
        if (!this::plot.isInitialized || (kind == "bar") != (plot is ChartBarInteraction)) {
            plot = if (kind == "bar") ChartBarInteraction() else ChartCartesianInteraction(false)
        }
        this.variant = variant
        val series = listOf(mapOf<String, AWCValue>("data" to data))
        val forward: (ChartEvent) -> Unit = { e ->
            if (e.name == "mdMarkerClick" || e.name == "mdBarClick") {
                val di = e.detail["dataIndex"] as Int
                onEvent(ChartEvent("mdSparkClick", mapOf("dataIndex" to di, "value" to (data.getOrNull(di) as? Number)?.toDouble())))
            }
        }
        when (val p = plot) {
            is ChartCartesianInteraction -> { p.series = series; p.tooltip = if (showTooltip) "axis" else "none"; p.missingFormatter = null; p.onEvent = forward }
            is ChartBarInteraction -> { p.series = series; p.tooltip = if (showTooltip) "axis" else "none"; p.missingFormatter = null; p.onEvent = forward }
        }
        plot.rtl = rtl; plot.reducedMotion = reducedMotion; plot.now = now
        val target = plot
        plot.rebuild = { rebuild(target) }
        plot.applyEngine()
    }
}
