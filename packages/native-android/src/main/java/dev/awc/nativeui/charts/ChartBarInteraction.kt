package dev.awc.nativeui.charts

import dev.awc.nativeui.AWCValue
import dev.awc.nativeui.awcList
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sign

// The interaction half of md-bar-chart, platform-neutral: bar-chart.ts (BarChartEngine hover / polar spotlight /
// dwell tooltip / bar click / legend self-toggle / hover re-resolve on render) plus the host (keyboard cursor and
// bar activation, live region, zoom window, drag band, pan, event payloads).

private const val POLAR_DIM = 0.62
private const val POLAR_FADE_MS = 200.0
private const val POLAR_DWELL_MS = 220.0

/** bar-chart.ts `pointInSlice` / `sliceAt`. */
fun chartPointInSlice(px: Double, py: Double, s: ChartSceneSlice): Boolean {
    val dx = px - s.cx; val dy = py - s.cy
    val r = hypot(dx, dy)
    if (r < s.innerR || r > s.outerR) return false
    val lo = min(s.startAngle, s.endAngle); val hi = max(s.startAngle, s.endAngle)
    val twoPi = PI * 2
    var d = (atan2(dy, dx) - lo) % twoPi
    if (d < 0) d += twoPi
    return d <= hi - lo
}

fun chartSliceAt(slices: List<ChartSceneSlice>, px: Double, py: Double): ChartSceneSlice? =
    slices.firstOrNull { it.endAngle != it.startAngle && chartPointInSlice(px, py, it) }

private fun sliceKey(dataIndex: Int, seriesIndex: Int?) = "$dataIndex:${seriesIndex ?: -1}"

/** bar-chart.ts `emphasizePolar`. */
fun chartEmphasizePolar(scene: ChartScene, dimByKey: Map<String, Double>, surface: String): ChartScene =
    scene.copy(slices = scene.slices.map { s -> val d = dimByKey[sliceKey(s.dataIndex, s.seriesIndex)] ?: 0.0; if (d > 0.002) s.copy(color = chartMixColor(s.color, surface, POLAR_DIM * d)) else s })

class ChartBarInteraction : ChartPlotInteraction {
    var series: List<Map<String, AWCValue>> = emptyList()
    var xAxisData: List<AWCValue>? = null
    var valueFormatter: (Double) -> String = { jsNumberString(it) }
    var formatters = ChartFormatters()
    var renderer: ((ChartTooltipContext) -> ChartTooltipContent)? = null
    /** Opts a series with no reading at the hovered x into a tooltip row (the charts pass `valueFormatter`; md-sparkline passes none). */
    var missingFormatter: ((Double?) -> String)? = null
    var locale = ""
    var labelPoint = "%x%: %values%"
    var tooltip = "axis"
    var zoom = "none"
    var polar = false
    var horizontal = false
    var clickable = false
    var surface = "#FFFBFE"
    override var rtl = false
    override var reducedMotion = false
    var doubleClickMs = 500.0
    var doubleClickSlop = 4.0
    override var onEvent: (ChartEvent) -> Unit = {}
    override var rebuild: () -> Unit = {}
    override var now: () -> Double = { System.nanoTime() / 1e6 }

    override var scene: ChartScene? = null
    var zoomWin: Pair<Int, Int>? = null; private set
    val legendHidden = LinkedHashMap<String, Boolean>()
    val hiddenOverride = HashMap<Int, Boolean>()
    override var kbIndex = -1; private set
    override var announcement = ""; private set
    override var hover: ChartHoverState? = null; private set
    override var hoverIndexAttr: Int? = null; private set
    override var dragBand: Pair<Double, Double>? = null; private set
    override var introToken = 0; private set
    /** The hand cursor over an actionable bar / segment. */
    var pointerCursor = false; private set
    private var lastHoverIndex = -2
    private var hoverSlice: Pair<Int, Int>? = null
    val dimAnim = HashMap<String, Double>()
    private var dimAnimating = false
    private var dimLast = 0.0
    private var tooltipDue: Double? = null
    /** True once after a zoom re-render (a view change snaps instead of following). */
    var zoomRenderPending = false
    fun consumeZoomRender(): Boolean { val z = zoomRenderPending; zoomRenderPending = false; return z }
    override val animating get() = dimAnimating || tooltipDue != null || (hover?.popStartMs?.let { now() - it < 320 } ?: false)
    private var tooltipFor: Pair<Int, Int>? = null
    private var tooltipShown = false
    private var lastPointer = 0.0 to 0.0
    private var downAt: Pair<Double, Double>? = null
    private sealed class Grab { class Band(val x: Double) : Grab(); class Pan(val frac: Double, val win: Pair<Int, Int>) : Grab() }
    private var grab: Grab? = null
    private var lastClick: Triple<Double, Double, Double>? = null

    override val zoomInside get() = !polar && (zoom == "inside" || zoom == "both")
    override val zoomSliderOn get() = !polar && (zoom == "slider" || zoom == "both")

    override fun dataLength() = max(series.fold(0) { acc, s -> max(acc, (s["data"] as? List<*>)?.size ?: 0) }, xAxisData?.size ?: 0)
    override fun win(): Pair<Int, Int> {
        val last = max(0, dataLength() - 1)
        val w = zoomWin ?: return 0 to last
        val start = min(max(0, w.first), max(0, last - 1))
        return start to min(max(start + 1, w.second), last)
    }
    override fun zoomWindow(): Pair<Int, Int>? = if (zoomWin != null && !polar) win() else null
    private fun winStart() = if (zoomWin != null && !polar) win().first else 0
    private fun emit(name: String, detail: Map<String, Any?>) = onEvent(ChartEvent(name, detail))

    // ── render (bar-chart.ts render(): new scene → re-resolve the hover at the same index) ──

    private fun render() {
        val had = scene?.xPositions?.size ?: 0
        hoverSlice = null; dimAnim.clear(); dimAnimating = false
        tooltipDue = null; tooltipShown = false
        rebuild()
        val s = scene ?: return
        if (lastHoverIndex >= 0) {
            if (lastHoverIndex < s.xPositions.size && had == s.xPositions.size) focusIndexInternal(lastHoverIndex)
            else { clearHover(); lastHoverIndex = -1 }
        }
    }

    override fun applyEngine() { hiddenOverride.clear(); render() }
    override fun resize() = render()
    override fun loadingChanged(now: Boolean, before: Boolean) { if (before && !now) replay() }
    override fun replay() { introToken++; render() }

    // ── hover ──

    private fun clearHover() { hover = null; hoverIndexAttr = null }

    private fun renderHover(s: ChartScene, index: Int, cx: Double, cy: Double, orient: String, focusSeries: Int, trigger: String) {
        val isNew = hoverIndexAttr != index
        if (index < 0) { clearHover(); return }
        if (index >= s.xPositions.size) { hover = null; return }
        hoverIndexAttr = index
        val model = chartHoverModel(s, index, valueFormatter, cx, cy, orient, focusSeries, trigger, missingFormatter, renderer)
        // hover.ts: the bar engine never passes the host direction to the card.
        hover = model?.let { ChartHoverState(it, s, false, if (isNew && !reducedMotion) now() else null) }
    }

    override fun tooltipOrigin(tw: Double, th: Double, roomAbove: Boolean): Pair<Double, Double>? {
        val h = hover ?: return null
        val m = h.model
        if (m.customText == null && m.rows.isEmpty()) return null
        // The Web places the card from offsetWidth / offsetHeight, which are whole pixels.
        val w = jsRound(tw); val hh = jsRound(th)
        val o = chartTooltipOrigin(h.scene, w, hh, m.cursorX, m.cursorY, m.orient, m.pos, h.rtl)
        return if (hh + 8 > h.scene.height && roomAbove) o.first to jsRound(-hh - 6) else o
    }

    private fun focusIndexInternal(index: Int) {
        val s = scene ?: return
        if (polar) {
            val next = if (index < 0) null else index to -1
            if (next?.first != hoverSlice?.first || next?.second != hoverSlice?.second) { hoverSlice = next; startDim() }
        }
        if (index < 0) { clearHover(); return }
        val pt = s.hoverPoints.firstNotNullOfOrNull { it.byIndex[index] }
        val pos = s.xPositions.getOrElse(index) { 0.0 }
        val cx = pt?.x ?: (if (horizontal) s.plot.x else pos)
        val cy = pt?.y ?: (if (horizontal) pos else s.plot.y)
        renderHover(s, index, cx, cy, if (polar) "none" else if (horizontal) "horizontal" else "vertical", -1, "axis")
    }

    private fun dimTarget(s: ChartSceneSlice): Double {
        val h = hoverSlice ?: return 0.0
        if (h.second < 0) return if (s.dataIndex == h.first) 0.0 else 1.0
        return if (s.dataIndex == h.first && s.seriesIndex == h.second) 0.0 else 1.0
    }

    private fun startDim() {
        val s = scene ?: return
        if (reducedMotion) {
            dimAnimating = false
            for (sl in s.slices) dimAnim[sliceKey(sl.dataIndex, sl.seriesIndex)] = dimTarget(sl)
            return
        }
        if (!dimAnimating) { dimLast = 0.0; dimAnimating = true }
    }

    /** One display frame: the polar spotlight fade and the dwell-delayed polar tooltip. */
    override fun tick(now: Double) {
        val s = scene
        if (dimAnimating && s != null) {
            val dt = if (dimLast != 0.0) now - dimLast else 16.0
            dimLast = now
            var moving = false
            for (sl in s.slices) {
                val key = sliceKey(sl.dataIndex, sl.seriesIndex)
                val target = dimTarget(sl)
                val cur = dimAnim[key] ?: 0.0
                var next = cur + sign(target - cur) * (dt / POLAR_FADE_MS)
                if ((target - cur) * (target - next) <= 0) next = target
                dimAnim[key] = next
                if (next != target) moving = true
            }
            dimAnimating = moving
        }
        val due = tooltipDue
        if (due != null && now >= due) {
            tooltipDue = null
            val h = hoverSlice; val f = tooltipFor
            if (h != null && f != null && h == f) { showPolarTooltip(f); tooltipShown = true }
        }
    }

    /** The scene as the canvas draws it (polar spotlight applied). */
    override fun drawnScene(): ChartScene? = scene?.let { if (polar) chartEmphasizePolar(it, dimAnim, surface) else it }

    private fun armTooltip(hovered: Pair<Int, Int>?) {
        tooltipDue = null
        clearHover()
        tooltipShown = false
        if (hovered == null) return
        tooltipFor = hovered
        tooltipDue = now() + POLAR_DWELL_MS
    }

    private fun showPolarTooltip(h: Pair<Int, Int>) {
        val s = scene ?: return
        renderHover(s, h.first, lastPointer.first, lastPointer.second, "none", h.second, "item")
    }

    private fun overBar(px: Double, py: Double) = scene?.bars?.any { px >= it.x && px <= it.x + it.w && py >= it.y && py <= it.y + it.h } == true

    // ── pointer ──

    fun insidePlot(px: Double, py: Double): Boolean { val p = scene?.plot ?: return false; return chartInsidePlot(p, px, py) }

    override fun pointerDown(px: Double, py: Double, button: Int) {
        downAt = px to py
        if (!zoomInside || button != 0 || grab != null) return
        if (!insidePlot(px, py)) return
        grab = Grab.Band(px)
        dragBand = px to px
    }

    override fun pointerMove(px: Double, py: Double) {
        when (val g = grab) {
            is Grab.Band -> scene?.plot?.let { p -> dragBand = g.x to min(max(px, p.x), p.x + p.width) }
            else -> {}
        }
        val s = scene ?: return
        if (tooltip == "none") return
        if (polar) {
            val slice = chartSliceAt(s.slices, px, py)
            val hovered = slice?.let { it.dataIndex to (it.seriesIndex ?: -1) }
            lastPointer = px to py
            pointerCursor = hovered != null
            if (hovered != hoverSlice) { hoverSlice = hovered; startDim(); armTooltip(hovered) }
            else if (tooltipShown && hovered != null) showPolarTooltip(hovered)
            val idx = hovered?.first ?: -1
            if (idx != lastHoverIndex) { lastHoverIndex = idx; hostHover(idx) }
            return
        }
        val idx = chartNearestIndex(s.xPositions, if (horizontal) py else px)
        pointerCursor = clickable && overBar(px, py)
        renderHover(s, idx, px, py, if (horizontal) "horizontal" else "vertical", -1, "axis")
        if (idx != lastHoverIndex) { lastHoverIndex = idx; hostHover(idx) }
    }

    override fun pointerLeave() {
        pointerCursor = false
        clearHover()
        if (polar && scene != null) {
            tooltipDue = null; tooltipShown = false
            if (hoverSlice != null) { hoverSlice = null; startDim() }
        }
        if (lastHoverIndex != -1) lastHoverIndex = -1
    }

    override fun pointerUp(px: Double, py: Double, insideCanvas: Boolean) {
        val captured = grab != null
        hostUp()
        if (insideCanvas || captured) {
            click(px, py)
            val t = now()
            val prev = lastClick
            if (prev != null && t - prev.third <= doubleClickMs && hypot(px - prev.first, py - prev.second) <= doubleClickSlop) { lastClick = null; doubleClick(px, py) }
            else lastClick = Triple(px, py, t)
        }
        downAt = null
    }

    private fun hostUp() {
        val g = grab ?: return
        grab = null
        val band = dragBand
        dragBand = null
        if (g !is Grab.Band || band == null) return
        if (abs(band.second - band.first) < 8) return
        val ab = listOf(indexAtX(band.first), indexAtX(band.second)).sorted()
        if (ab[1] - ab[0] >= 1) applyZoom(ab[0].toDouble(), ab[1].toDouble())
    }

    private fun indexAtX(x: Double): Int {
        val s = scene; val w = win()
        if (s == null || s.xPositions.isEmpty()) return w.first
        var best = 0; var bestD = Double.POSITIVE_INFINITY
        s.xPositions.forEachIndexed { i, p -> val d = abs(p - x); if (d < bestD) { bestD = d; best = i } }
        return w.first + best
    }

    private fun click(px: Double, py: Double) {
        val s = scene ?: return
        if (polar) { chartSliceAt(s.slices, px, py)?.let { barClick(it.seriesIndex ?: 0, it.dataIndex) }; return }
        for (b in s.bars) if (px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) { barClick(b.seriesIndex, b.dataIndex); return }
    }

    override fun doubleClick(px: Double, py: Double) { if (zoomInside && zoomWin != null && insidePlot(px, py)) resetZoom() }

    // ── zoom ──

    fun applyZoom(start: Double, end: Double, reset: Boolean = false) {
        val last = max(0, dataLength() - 1)
        val s = min(max(0, jsRound(start).toInt()), max(0, last - 1))
        val e = min(max(s + 1, jsRound(end).toInt()), last)
        zoomWin = if (reset) null else s to e
        zoomRenderPending = true
        applyEngine()
        emit("mdZoom", mapOf("startIndex" to (if (reset) 0 else s), "endIndex" to (if (reset) last else e), "reset" to reset))
    }
    override fun setZoom(start: Double, end: Double) = applyZoom(start, end)
    override fun resetZoom() = applyZoom(0.0, 0.0, true)
    override fun zoomSliderInput(valueStart: Double, valueEnd: Double) = applyZoom(valueStart, valueEnd)
    override fun panStart(frac: Double) { grab = Grab.Pan(frac, win()) }
    override fun panMove(frac: Double) {
        val g = grab as? Grab.Pan ?: return
        val last = max(1, dataLength() - 1)
        val span = g.win.second - g.win.first
        val delta = jsRound((frac - g.frac) * last).toInt()
        val s = min(max(0, g.win.first + delta), last - span)
        applyZoom(s.toDouble(), (s + span).toDouble())
    }
    override fun panEnd() { if (grab is Grab.Pan) grab = null }

    // ── legend ──

    override fun legendToggle(seriesIndex: Int) {
        if (seriesIndex !in series.indices) return
        val s = series[seriesIndex]
        val key = chartSeriesKeys(series)[seriesIndex]
        val nh = !(hiddenOverride[seriesIndex] ?: (s["hidden"] as? Boolean) ?: legendHidden[key] ?: false)
        hiddenOverride[seriesIndex] = nh
        introToken++
        render()
        legendHidden.remove(key); legendHidden[key] = nh
        if (legendHidden.size > 256) legendHidden.remove(legendHidden.keys.first())
        val d = LinkedHashMap<String, Any?>()
        d["seriesIndex"] = seriesIndex
        s["id"]?.let { d["seriesId"] = it }
        d["selected"] = !nh
        emit("mdLegendClick", d)
    }

    // ── keyboard ──

    override fun keyDown(key: String): Boolean {
        val s = scene ?: return false
        val last = max(0, s.xPositions.size - 1)
        if (key == "Enter" || key == " " || key == "Spacebar") {
            if (kbIndex < 0) return false
            val si = visibleSeriesIndices().firstOrNull() ?: 0
            barClick(si, kbIndex)
            return true
        }
        val next = chartKeyboardNext(key, kbIndex, last, rtl) ?: return false
        moveKeyboardCursor(next)
        return true
    }

    override fun blur() { if (kbIndex >= 0) moveKeyboardCursor(-1) }

    private fun moveKeyboardCursor(next: Int) {
        kbIndex = next
        lastHoverIndex = next
        focusIndexInternal(next)
        if (next < 0) { announcement = ""; return }
        val s = scene
        val xText = s?.xLabels?.getOrNull(next) ?: (next + 1).toString()
        val yFmt: (Double) -> String = { v -> formatters.valueFormatter?.invoke(v) ?: ChartIntl.number(v, locale) }
        val values = (s?.hoverPoints ?: emptyList()).mapNotNull { hp -> hp.byIndex[next]?.let { "${hp.label} ${yFmt(it.value)}" } }.joinToString(", ")
        announcement = chartJsReplaceFirst(chartJsReplaceFirst(labelPoint, "%x%", xText), "%values%", values)
    }

    // ── payloads ──

    private fun hostHover(idx: Int) {
        if (idx < 0) return
        val abs = idx + winStart()
        emit("mdHover", mapOf("dataIndex" to abs, "axisValue" to xAxisData?.getOrNull(abs), "seriesIndices" to visibleSeriesIndices()))
    }

    override fun visibleSeriesIndices(): List<Int> {
        scene?.let { s -> return s.hoverPoints.map { it.seriesIndex } }
        return series.indices.filter { series[it]["hidden"] != true }
    }

    private fun barClick(si: Int, di: Int) {
        val s = series.getOrNull(si) ?: return
        val abs = di + winStart()
        val d = LinkedHashMap<String, Any?>()
        d["seriesIndex"] = si
        s["id"]?.let { d["seriesId"] = it }
        d["dataIndex"] = abs
        d["value"] = awcList(s["data"]).getOrNull(abs)
        d["axisValue"] = xAxisData?.getOrNull(abs)
        d["series"] = s
        emit("mdBarClick", d)
    }
}
