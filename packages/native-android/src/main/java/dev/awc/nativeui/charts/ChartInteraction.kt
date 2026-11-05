package dev.awc.nativeui.charts

import dev.awc.nativeui.AWCValue
import dev.awc.nativeui.awcList
import kotlin.math.abs
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min

// The interaction half of md-line-chart / md-area-chart, platform-neutral: chart.ts (LineChartEngine pointer,
// click, focusIndex, legend self-toggle, hover emphasis) plus the host component (keyboard cursor, live region,
// zoom window, drag band, pan, event payloads). Inputs are in plot-canvas coordinates; the Compose and SwiftUI
// views feed gestures in, draw `scene` / `hover` / `dragBand`, and dispatch `onEvent`.

/** A component event as the Web element dispatches it: the event name and its detail, minus `nativeEvent`. */
data class ChartEvent(val name: String, val detail: Map<String, Any?>)

/** JS `String.prototype.replace(string, string)`: the first occurrence only, with the `$$ $& $` $'` patterns. */
fun chartJsReplaceFirst(s: String, pattern: String, replacement: String): String {
    val i = s.indexOf(pattern)
    if (i < 0) return s
    val r = StringBuilder()
    var k = 0
    while (k < replacement.length) {
        val c = replacement[k]
        if (c == '$' && k + 1 < replacement.length) {
            when (replacement[k + 1]) {
                '$' -> { r.append('$'); k += 2; continue }
                '&' -> { r.append(pattern); k += 2; continue }
                '`' -> { r.append(s, 0, i); k += 2; continue }
                '\'' -> { r.append(s, i + pattern.length, s.length); k += 2; continue }
            }
        }
        r.append(c); k++
    }
    return s.substring(0, i) + r + s.substring(i + pattern.length)
}

/** A raw axis value as an event detail carries it (string / number; a Date as its epoch ms). */
fun chartAxisDetail(v: ChartAxisValue?): Any? = when (v) { null -> null; is ChartAxisValue.Str -> v.v; is ChartAxisValue.Num -> v.v; is ChartAxisValue.DateMs -> v.ms }

/** xy.ts `datumY`. */
fun chartDatumY(d: AWCValue): Double? = when (d) {
    null -> null
    is Number -> d.toDouble()
    is Map<*, *> -> (d["y"] as? Number)?.toDouble()
    is List<*> -> (d.getOrNull(1) as? Number)?.toDouble()
    else -> null
}


/** What a chart view needs from its interaction controller (line / area and bar share it). */
interface ChartPlotInteraction {
    var scene: ChartScene?
    val hover: ChartHoverState?
    val hoverIndexAttr: Int?
    val announcement: String
    val kbIndex: Int
    val dragBand: Pair<Double, Double>?
    val introToken: Int
    var rtl: Boolean
    var reducedMotion: Boolean
    var now: () -> Double
    var onEvent: (ChartEvent) -> Unit
    var rebuild: () -> Unit
    val zoomInside: Boolean
    val zoomSliderOn: Boolean
    /** True while a hover pop, emphasis fade or bar dim / tooltip dwell is running (the view keeps drawing frames). */
    val animating: Boolean
    fun applyEngine()
    fun resize()
    fun replay()
    fun loadingChanged(now: Boolean, before: Boolean)
    fun tick(now: Double)
    fun drawnScene(): ChartScene?
    fun pointerDown(px: Double, py: Double, button: Int)
    fun pointerMove(px: Double, py: Double)
    fun pointerLeave()
    fun pointerUp(px: Double, py: Double, insideCanvas: Boolean)
    fun doubleClick(px: Double, py: Double)
    fun keyDown(key: String): Boolean
    fun blur()
    fun legendToggle(seriesIndex: Int)
    fun win(): Pair<Int, Int>
    fun zoomWindow(): Pair<Int, Int>?
    fun dataLength(): Int
    fun setZoom(start: Double, end: Double)
    fun resetZoom()
    fun zoomSliderInput(valueStart: Double, valueEnd: Double)
    fun panStart(frac: Double)
    fun panMove(frac: Double)
    fun panEnd()
    fun tooltipOrigin(tw: Double, th: Double, roomAbove: Boolean): Pair<Double, Double>?
    fun visibleSeriesIndices(): List<Int>
}

class ChartHoverState(val model: ChartHoverModel, val scene: ChartScene, val rtl: Boolean, val popStartMs: Double?)

class ChartCartesianInteraction(val isArea: Boolean) : ChartPlotInteraction {
    // ── host-provided configuration (refreshed on every property change) ──
    var series: List<Map<String, AWCValue>> = emptyList()
    var xAxisData: List<AWCValue>? = null
    var merged: ChartNormalizedX? = null
    var yFormatter: (Double) -> String = { jsNumberString(it) }
    var formatters = ChartFormatters()
    var renderer: ((ChartTooltipContext) -> ChartTooltipContent)? = null
    /** Opts a series with no reading at the hovered x into a tooltip row (the charts pass `valueFormatter`; md-sparkline passes none). */
    var missingFormatter: ((Double?) -> String)? = null
    var locale = ""
    var labelPoint = "%x%: %values%"
    var tooltip = "axis"
    var zoom = "none"
    override var rtl = false
    override var reducedMotion = false
    var doubleClickMs = 500.0
    var doubleClickSlop = 4.0
    override var onEvent: (ChartEvent) -> Unit = {}
    /** Rebuild `scene` from the current props, `zoomWindow()`, `legendHidden` and `hiddenOverride`. */
    override var rebuild: () -> Unit = {}
    override var now: () -> Double = { System.nanoTime() / 1e6 }

    // ── state ──
    override var scene: ChartScene? = null
    var zoomWin: Pair<Int, Int>? = null; private set
    val legendHidden = LinkedHashMap<String, Boolean>()
    val hiddenOverride = HashMap<Int, Boolean>()
    override var kbIndex = -1; private set
    override var announcement = ""; private set
    override var hover: ChartHoverState? = null; private set
    /** data-hover-index of the hover layer: survives a re-render, cleared on leave / Escape. */
    override var hoverIndexAttr: Int? = null; private set
    override var dragBand: Pair<Double, Double>? = null; private set
    var emphasisSeries = -1; private set
    var emphasisT = 0.0; private set
    private var emphasisTarget = 0.0
    private var emphasisLast = 0.0
    var emphasisAnimating = false; private set
    override val animating get() = emphasisAnimating || (hover?.popStartMs?.let { now() - it < 320 } ?: false)
    /** Bumped whenever the entrance should replay (legend toggle, loading → loaded). */
    override var introToken = 0; private set
    private var lastHoverIndex = -2
    private val focus = ChartHoverFocus()
    private var downAt: Pair<Double, Double>? = null
    private var dragged = false
    private sealed class Grab { class Band(val x: Double) : Grab(); class Pan(val frac: Double, val win: Pair<Int, Int>) : Grab() }
    private var grab: Grab? = null
    private var lastClick: Triple<Double, Double, Double>? = null

    override val zoomInside get() = zoom == "inside" || zoom == "both"
    override val zoomSliderOn get() = zoom == "slider" || zoom == "both"

    override fun dataLength(): Int = if (isArea) {
        max(series.fold(0) { acc, s -> max(acc, (s["range"] as? List<*>)?.size ?: (s["data"] as? List<*>)?.size ?: 0) }, xAxisData?.size ?: 0)
    } else {
        val m = merged
        if (m == null) 0 else max(m.data.fold(0) { acc, d -> max(acc, d.size) }, m.xValues.size)
    }

    override fun win(): Pair<Int, Int> {
        val last = max(0, dataLength() - 1)
        val w = zoomWin ?: return 0 to last
        val start = min(max(0, w.first), max(0, last - 1))
        return start to min(max(start + 1, w.second), last)
    }

    /** The window the spec is cut to (null = the full range). */
    override fun zoomWindow(): Pair<Int, Int>? = if (zoomWin == null) null else win()

    private fun absOf(local: Int) = local + (if (zoomWin != null) win().first else 0)
    private fun axisValueAt(abs: Int): Any? = if (isArea) xAxisData?.getOrNull(abs) else chartAxisDetail(merged?.xValues?.getOrNull(abs))
    private fun emit(name: String, detail: Map<String, Any?>) = onEvent(ChartEvent(name, detail))

    // ── spec lifecycle (setSpec / replay) ──

    /** Any property change: the host's applyEngine → engine.setSpec. */
    override fun applyEngine() {
        focus.reset()
        emphasisSeries = -1; emphasisT = 0.0; emphasisTarget = 0.0; emphasisAnimating = false
        hiddenOverride.clear()
        if (!isArea) {
            val keys = chartSeriesKeys(series)
            series.forEachIndexed { i, s -> if (s.containsKey("hidden") && s["hidden"] != null) legendHidden.remove(keys[i]) }
        }
        rebuild()
    }

    /** The canvas box changed size: re-lay-out with the same spec (engine.resize → render), keeping hover focus. */
    override fun resize() = rebuild()

    override fun loadingChanged(now: Boolean, before: Boolean) { if (before && !now) introToken++ }
    /** chart.ts replay(): hasRendered = false; render() — the entrance plays again from t = 0. */
    override fun replay() { introToken++; rebuild() }

    // ── emphasis (setFocus + its 260 ms fade) ──

    private fun setFocus(idx: Int) {
        val target = if (idx >= 0) 1.0 else 0.0
        val si = if (idx >= 0) idx else emphasisSeries
        if (target == emphasisTarget && si == emphasisSeries) return
        emphasisSeries = si; emphasisTarget = target
        if (reducedMotion) {
            emphasisAnimating = false
            emphasisT = target
            if (target == 0.0) emphasisSeries = -1
            return
        }
        emphasisAnimating = true; emphasisLast = 0.0
    }

    /** Advance the emphasis fade to `now` (one display frame). */
    override fun tick(now: Double) {
        if (!emphasisAnimating) return
        val dt = if (emphasisLast == 0.0) 0.0 else now - emphasisLast
        emphasisLast = now
        val dir = if (emphasisTarget > emphasisT) 1 else -1
        emphasisT += dir * (dt / CHART_EMPHASIS_MS)
        if ((dir > 0 && emphasisT >= emphasisTarget) || (dir < 0 && emphasisT <= emphasisTarget)) {
            emphasisT = emphasisTarget
            if (emphasisTarget == 0.0) emphasisSeries = -1
            emphasisAnimating = false
        }
    }

    /** The scene as the canvas draws it right now (hover emphasis applied). */
    override fun drawnScene(): ChartScene? = scene?.let { chartEmphasizeScene(it, emphasisSeries, emphasisT) }

    // ── hover layer ──

    private fun clearHover() { hover = null; hoverIndexAttr = null }

    private fun renderHover(s: ChartScene, index: Int, cx: Double, cy: Double, orient: String, focusSeries: Int) {
        val isNew = hoverIndexAttr != index
        if (index < 0) { clearHover(); return }
        if (index >= s.xPositions.size) { hover = null; return }
        hoverIndexAttr = index
        val model = chartHoverModel(s, index, yFormatter, cx, cy, orient, focusSeries, if (tooltip == "item") "item" else "axis", missingFormatter, renderer)
        // A custom card is positioned without the host direction (hover.ts passes no rtl on that path).
        hover = model?.let { ChartHoverState(it, s, if (it.customText != null) false else rtl, if (isNew && !reducedMotion) now() else null) }
    }

    /** Where the tooltip card goes for a measured card size; `roomAbove` = the host's top edge has room for it in the viewport. */
    override fun tooltipOrigin(tw: Double, th: Double, roomAbove: Boolean): Pair<Double, Double>? {
        val h = hover ?: return null
        val m = h.model
        if (m.customText == null && m.rows.isEmpty()) return null
        // The Web places the card from offsetWidth / offsetHeight, which are whole pixels.
        val w = jsRound(tw); val hh = jsRound(th)
        val o = chartTooltipOrigin(h.scene, w, hh, m.cursorX, m.cursorY, m.orient, m.pos, h.rtl)
        return if (hh + 8 > h.scene.height && roomAbove) o.first to jsRound(-hh - 6) else o
    }

    private fun nearestSeries(s: ChartScene, px: Double, py: Double): Int {
        if (s.areas.isNotEmpty() && tooltip != "item") { focus.reset(); return -1 }
        val inArea = chartAreaSeriesAt(s, px, py)
        if (inArea >= 0) { focus.reset(); return inArea }
        val inverted = s.inverted == true
        val lines = chartSeriesSampleLines(s)
        val candidates = s.hoverPoints.mapIndexed { i, hp -> hp.seriesIndex to chartDistanceToLine(lines[i], if (inverted) py else px, if (inverted) px else py) }
        return focus.pick(candidates, now())
    }

    // ── pointer ──

    fun insidePlot(px: Double, py: Double): Boolean { val p = scene?.plot ?: return false; return chartInsidePlot(p, px, py) }

    override fun pointerDown(px: Double, py: Double, button: Int) {
        downAt = px to py; dragged = false
        if (!zoomInside || button != 0 || grab != null) return
        if (!insidePlot(px, py)) return
        grab = Grab.Band(px)
        dragBand = px to px
    }

    override fun pointerMove(px: Double, py: Double) {
        downAt?.let { if (hypot(px - it.first, py - it.second) > 8) dragged = true }
        // The host's handler runs in the event; the engine's hover waits for the next frame, so it sees the result.
        when (val g = grab) {
            is Grab.Band -> scene?.plot?.let { p -> dragBand = g.x to min(max(px, p.x), p.x + p.width) }
            else -> {}
        }
        val s = scene ?: return
        if (tooltip == "none") return
        val inverted = s.inverted == true
        val idx = chartNearestIndex(s.xPositions, if (inverted) py else px)
        val f = if (s.hoverPoints.size > 1) nearestSeries(s, px, py) else -1
        renderHover(s, idx, px, py, if (inverted) "horizontal" else "vertical", f)
        setFocus(f)
        if (idx != lastHoverIndex) { lastHoverIndex = idx; hostHover(idx) }
    }

    override fun pointerLeave() {
        clearHover()
        focus.reset()
        setFocus(-1)
        if (lastHoverIndex != -1) lastHoverIndex = -1
    }

    /** Release: the host's drag-band end, then the click the browser fires, then dblclick on a second quick click. */
    override fun pointerUp(px: Double, py: Double, insideCanvas: Boolean) {
        val captured = grab != null
        hostUp()
        if (insideCanvas || captured) {
            click(px, py)
            val t = now()
            val prev = lastClick
            if (prev != null && t - prev.third <= doubleClickMs && hypot(px - prev.first, py - prev.second) <= doubleClickSlop) {
                lastClick = null
                doubleClick(px, py)
            } else lastClick = Triple(px, py, t)
        } else { dragged = false; downAt = null }
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
        val s = scene
        val w = win()
        if (s == null || s.xPositions.isEmpty()) return w.first
        var best = 0; var bestD = Double.POSITIVE_INFINITY
        s.xPositions.forEachIndexed { i, p -> val d = abs(p - x); if (d < bestD) { bestD = d; best = i } }
        return w.first + best
    }

    private fun click(px: Double, py: Double) {
        val wasDragged = dragged
        dragged = false; downAt = null
        val s = scene ?: return
        when (val hit = chartHitTestScene(s, px, py) ?: return) {
            is ChartHit.Mark -> clickDetail(hit.series, hit.index)?.let { emit("mdMarkerClick", it) }
            is ChartHit.Line -> if (!wasDragged) clickDetail(hit.series, hit.index)?.let { emit("mdLineClick", it) }
            is ChartHit.Area -> if (!wasDragged) clickDetail(hit.series, hit.index)?.let { emit("mdAreaClick", it) }
            is ChartHit.Axis -> if (!wasDragged) emit("mdAxisClick", axisDetail(hit.index, chartAxisSeriesValues(s, hit.index)))
        }
    }

    override fun doubleClick(px: Double, py: Double) {
        if (zoomInside && zoomWin != null && insidePlot(px, py)) resetZoom()
    }

    // ── zoom ──

    fun applyZoom(start: Double, end: Double, reset: Boolean = false) {
        val last = max(0, dataLength() - 1)
        val s = min(max(0, jsRound(start).toInt()), max(0, last - 1))
        val e = min(max(s + 1, jsRound(end).toInt()), last)
        zoomWin = if (reset) null else s to e
        applyEngine()
        emit("mdZoom", mapOf("startIndex" to (if (reset) 0 else s), "endIndex" to (if (reset) last else e), "reset" to reset))
    }

    override fun setZoom(start: Double, end: Double) = applyZoom(start, end)
    override fun resetZoom() = applyZoom(0.0, 0.0, true)
    /** md-slider (range) mdInput while a thumb moves. */
    override fun zoomSliderInput(valueStart: Double, valueEnd: Double) = applyZoom(valueStart, valueEnd)
    /** Pan grip: `frac` is the pointer's RTL-aware fraction along the slider track. */
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

    private fun specHidden(i: Int): Boolean {
        val s = series.getOrNull(i) ?: return false
        return hiddenOverride[i] ?: (s["hidden"] as? Boolean) ?: legendHidden[chartSeriesKeys(series)[i]] ?: false
    }

    override fun legendToggle(seriesIndex: Int) {
        if (seriesIndex !in series.indices) return
        val nh = !specHidden(seriesIndex)
        hiddenOverride[seriesIndex] = nh
        introToken++
        rebuild()
        val key = chartSeriesKeys(series)[seriesIndex]
        legendHidden.remove(key); legendHidden[key] = nh
        if (legendHidden.size > 256) legendHidden.remove(legendHidden.keys.first())
        val d = LinkedHashMap<String, Any?>()
        d["seriesIndex"] = seriesIndex
        series[seriesIndex]["id"]?.let { d["seriesId"] = it }
        d["selected"] = !nh
        emit("mdLegendClick", d)
    }

    // ── keyboard ──

    /** Plot keydown; true when handled (the view then consumes the key). */
    override fun keyDown(key: String): Boolean {
        val last: Int
        if (isArea) {
            val s = scene ?: return false
            last = max(0, s.xPositions.size - 1)
        } else {
            val length = dataLength()
            if (length == 0) return false
            last = if (zoomWin != null) win().second - win().first else length - 1
        }
        if (!isArea && (key == "Enter" || key == " ")) {
            if (kbIndex < 0) return false
            emit("mdAxisClick", axisDetail(kbIndex, seriesValuesAt(kbIndex)))
            return true
        }
        val next = chartKeyboardNext(key, kbIndex, last, rtl) ?: return false
        moveKeyboardCursor(next)
        return true
    }

    override fun blur() { if (kbIndex >= 0) moveKeyboardCursor(-1) }

    private fun moveKeyboardCursor(next: Int) {
        kbIndex = next
        focusIndex(next)
        if (next < 0) { announcement = ""; return }
        val yFmt: (Double) -> String = { v -> formatters.valueFormatter?.invoke(v) ?: ChartIntl.number(v, locale) }
        if (isArea) {
            val s = scene
            val xText = s?.xLabels?.getOrNull(next) ?: (next + 1).toString()
            val values = (s?.hoverPoints ?: emptyList()).mapNotNull { hp -> hp.byIndex[next]?.let { "${hp.label} ${yFmt(it.value)}" } }.joinToString(", ")
            announcement = chartJsReplaceFirst(chartJsReplaceFirst(labelPoint, "%x%", xText), "%values%", values)
            return
        }
        val abs = absOf(next)
        val xRaw = merged?.xValues?.getOrNull(abs)
        val xf = formatters.xAxisFormatter
        val xText = if (xf != null && xRaw != null) xf(xRaw) else chartDefaultValueFormatter(xRaw ?: ChartAxisValue.Num((abs + 1).toDouble()), locale)
        val values = seriesValuesAt(next).filter { it.value != null }.joinToString(", ") { "${it.label} ${yFmt(it.value!!)}" }
        announcement = chartJsReplaceFirst(chartJsReplaceFirst(labelPoint, "%x%", xText), "%values%", values)
        emit("mdHover", mapOf("dataIndex" to abs, "axisValue" to chartAxisDetail(xRaw), "seriesIndices" to visibleSeriesIndices()))
    }

    /** chart.ts `focusIndex`: the pointer's hover UI, anchored on the topmost point at the index. */
    private fun focusIndex(index: Int) {
        val s = scene ?: return
        if (index < 0) { clearHover(); focus.reset(); setFocus(-1); return }
        val inverted = s.inverted == true
        val pt = s.hoverPoints.firstNotNullOfOrNull { it.byIndex[index] }
        val pos = s.xPositions.getOrElse(index) { 0.0 }
        val cx = pt?.x ?: (if (inverted) s.plot.x else pos)
        val cy = pt?.y ?: (if (inverted) pos else s.plot.y)
        renderHover(s, index, cx, cy, if (inverted) "horizontal" else "vertical", -1)
    }

    // ── event payloads ──

    private fun hostHover(idx: Int) {
        if (idx < 0) return
        val abs = absOf(idx)
        emit("mdHover", mapOf("dataIndex" to abs, "axisValue" to axisValueAt(abs), "seriesIndices" to visibleSeriesIndices()))
    }

    override fun visibleSeriesIndices(): List<Int> {
        scene?.let { s -> return s.hoverPoints.map { it.seriesIndex } }
        if (isArea) return series.indices.filter { series[it]["hidden"] != true }
        val keys = chartSeriesKeys(series)
        return series.indices.filter { !((series[it]["hidden"] as? Boolean) ?: legendHidden[keys[it]] ?: false) }
    }

    private fun seriesValuesAt(di: Int): List<ChartAxisSeriesValue> = scene?.let { chartAxisSeriesValues(it, di) } ?: emptyList()

    private fun ownIndex(si: Int, abs: Int): Int {
        val toOwn = merged?.toOwn?.getOrNull(si) ?: return abs
        return toOwn.getOrNull(abs) ?: -1
    }

    private fun clickDetail(si: Int, di: Int): Map<String, Any?>? {
        val s = series.getOrNull(si) ?: return null
        val abs = absOf(di)
        val d = LinkedHashMap<String, Any?>()
        d["seriesIndex"] = si
        s["id"]?.let { d["seriesId"] = it }
        if (isArea) {
            d["dataIndex"] = abs
            d["value"] = awcList(s["data"]).getOrNull(abs)
        } else {
            val own = ownIndex(si, abs)
            d["dataIndex"] = if (own >= 0) own else abs
            d["value"] = if (own >= 0) chartDatumY(awcList(s["data"]).getOrNull(own)) else null
        }
        d["axisValue"] = axisValueAt(abs)
        d["series"] = s
        return d
    }

    private fun axisDetail(di: Int, values: List<ChartAxisSeriesValue>): Map<String, Any?> {
        val abs = absOf(di)
        val sv = values.map { v ->
            val m = LinkedHashMap<String, Any?>()
            m["seriesIndex"] = v.seriesIndex
            series.getOrNull(v.seriesIndex)?.get("id")?.let { m["seriesId"] = it }
            m["label"] = v.label
            m["dataIndex"] = if (v.value == null) -1 else if (isArea) abs else ownIndex(v.seriesIndex, abs)
            m["value"] = v.value
            m
        }
        return mapOf("dataIndex" to abs, "axisValue" to axisValueAt(abs), "seriesValues" to sv)
    }
}
