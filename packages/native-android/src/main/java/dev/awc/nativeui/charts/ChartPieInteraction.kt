package dev.awc.nativeui.charts

import dev.awc.nativeui.AWCValue
import dev.awc.nativeui.awcList
import dev.awc.nativeui.awcMap
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin

// The interaction half of md-pie-chart, platform-neutral: pie-chart.ts (PieChartEngine hover rim tween, tooltip,
// press ripple, click-to-pick with its slide, legend self-toggle, drill arming, the hover reset when the slices
// change) plus the host (keyboard cursor over the drawn slices, activation, live region, cursor re-sync).

private const val HOVER_TWEEN_MS = 260.0
private const val RIPPLE_MS = 450.0
private const val RIPPLE_ALPHA = 0.16
private const val SELECT_MS = 300.0
const val CHART_DRILL_MS = 520.0
private const val DRILL_CROSSFADE = 0.5
/** Slice labels hold back until the entrance reaches this point, then fade in over 180 ms. */
const val CHART_PIE_LABEL_ARRIVES_AT = 0.8

/** pie-chart.ts `pointInSlice` about the slice's own centre. */
fun chartPieSliceAt(scene: ChartScene, px: Double, py: Double): ChartSceneSlice? = scene.slices.firstOrNull { chartPointInSlice(px, py, it) }

private fun ringSlices(scene: ChartScene) = scene.slices.filter { it.pill != true && it.endAngle != it.startAngle }

/** animate.ts `splitScene`: the drill frame (outer level opening around the pivot, inner level laid in its window). */
fun chartSplitScene(outer: ChartScene, inner: ChartScene, pivotIndex: Int, pRaw: Double): Triple<ChartScene, ChartScene, Double>? {
    val p = pRaw.coerceIn(0.0, 1.0)
    val outs = ringSlices(outer); val ins = ringSlices(inner)
    if (outs.isEmpty() || ins.isEmpty()) return null
    val pivot = outs.firstOrNull { it.dataIndex == pivotIndex } ?: outs[0]
    val ringStart = outs[0].startAngle
    val total = outs.fold(0.0) { acc, s -> acc + (s.endAngle - s.startAngle) }
    val pivotSpan = pivot.endAngle - pivot.startAngle
    val rest = total - pivotSpan
    val w = pivotSpan + rest * p
    val w0 = pivot.startAngle + (ringStart - pivot.startAngle) * p
    val k = if (abs(rest) < 1e-9) 0.0 else (total - w) / rest
    val at = outs.indexOf(pivot)
    val order = outs.subList(at + 1, outs.size) + outs.subList(0, at)
    var cursor = w0 + w
    val base = order.map { s -> val span = (s.endAngle - s.startAngle) * k; val a0 = cursor; cursor += span; s.copy(startAngle = a0, endAngle = cursor) }.toMutableList()
    base.add(pivot.copy(startAngle = w0, endAngle = w0 + w))
    val innerStart = ins[0].startAngle
    val innerTotal = ins.fold(0.0) { acc, s -> acc + (s.endAngle - s.startAngle) }.let { if (it == 0.0) 1.0 else it }
    fun map(a: Double) = w0 + ((a - innerStart) / innerTotal) * w
    val over = ins.map { it.copy(startAngle = map(it.startAngle), endAngle = map(it.endAngle)) }
    return Triple(
        outer.copy(slices = base, lines = emptyList(), gridlines = emptyList(), texts = emptyList()),
        inner.copy(slices = over, lines = emptyList(), gridlines = emptyList(), texts = emptyList(), background = null),
        (p / DRILL_CROSSFADE).coerceIn(0.0, 1.0),
    )
}

/** One frame of a pie drill for the renderer: draw `base`, then `over` at `overAlpha`. */
class ChartPieDrillFrame(val base: ChartScene, val over: ChartScene, val overAlpha: Double, val labelProgress: Double)

class ChartPieTooltip(val index: Int, val label: String?, val value: String?, val color: String?, val customText: String?, val anchorX: Double, val anchorY: Double)

class ChartPieInteraction {
    /** The `data` property (a tree: `children` nest rings). */
    var data: List<Map<String, AWCValue>> = emptyList()
    var valueFormatter: ((Double) -> String)? = null
    var renderer: ((ChartTooltipContext) -> ChartTooltipContent)? = null
    var locale = ""
    var labelPoint = "%label%: %value% (%percent%)"
    var rtl = false
    var reducedMotion = false
    var onEvent: (ChartEvent) -> Unit = {}
    /** md-pie-chart buildSpec from the current props, theme and `legendHidden`. */
    var buildSpec: () -> ChartPieSpec = { error("buildSpec not set") }
    /** pie-layout computePieLayout for the current size. */
    var layout: (ChartPieSpec) -> ChartScene = { error("layout not set") }
    var now: () -> Double = { System.nanoTime() / 1e6 }
    /** Called after every layout (the host arms its entrance clock from it). */
    var onRender: () -> Unit = {}

    var spec: ChartPieSpec? = null; private set
    var scene: ChartScene? = null; private set
    val legendHidden = LinkedHashMap<String, Boolean>()
    var kbIndex = -1; private set
    var announcement = ""; private set
    var tooltip: ChartPieTooltip? = null; private set
    var pointerCursor = false; private set
    var introToken = 0; private set
    private var hoverIndex = -1
    private var litIndex = -1
    var hoverT = 0.0; private set
    private var hoverTween: Triple<Double, Double, Double>? = null
    private var selectTween: Triple<Double, List<Double>, List<Double>>? = null
    private var ripple: Pair<ChartSceneRipple, Double>? = null
    private var rippleMax = 0.0
    private var pendingDrill: Triple<Int, Boolean, ChartScene>? = null
    private var drillRun: Triple<Int, Boolean, ChartScene>? = null
    private var drillStart = 0.0

    private fun emit(name: String, detail: Map<String, Any?>) = onEvent(ChartEvent(name, detail))

    // ── the slices as the host sees them (depth-first, the engine's order) ──

    private class Entry(val d: Map<String, AWCValue>, val parent: Int?, val hidden: Boolean, val drawn: Boolean)

    private fun flatDatums(): List<Map<String, AWCValue>> {
        val out = mutableListOf<Map<String, AWCValue>>()
        fun walk(items: List<Map<String, AWCValue>>) { for (d in items) { out.add(d); walk(awcList(d["children"]).map { awcMap(it) }) } }
        walk(data)
        return out
    }

    private fun entries(): List<Entry> {
        val keys = chartPieDatumKeys(flatDatums())
        val out = mutableListOf<Entry>()
        fun walk(items: List<Map<String, AWCValue>>, parent: Int?, underHidden: Boolean) {
            for (d in items) {
                val at = out.size
                val hidden = (d["hidden"] as? Boolean) ?: legendHidden[keys[at]] ?: false
                out.add(Entry(d, parent, hidden, !hidden && !underHidden))
                walk(awcList(d["children"]).map { awcMap(it) }, at, underHidden || hidden)
            }
        }
        walk(data, null, false)
        return out
    }

    private fun navigable() = entries().withIndex().filter { it.value.drawn }.map { it.index }
    private fun num(v: AWCValue) = (v as? Number)?.toDouble() ?: Double.NaN
    private fun formatValue(v: Double) = valueFormatter?.invoke(v) ?: ChartIntl.number(v, locale)
    private fun formatPercent(p: Double) = ChartIntl.number(p, locale, 0, 1) + "%"

    // ── spec lifecycle ──

    /** Any property change (and the first mount): md-pie-chart applyEngine → engine.setSpec. */
    fun applyEngine() {
        val next = buildSpec()
        val before = spec?.data
        val changed = before == null || before.size != next.data.size ||
            before.withIndex().any { (i, d) -> d.label != next.data.getOrNull(i)?.label || !jsEq(d.value, next.data.getOrNull(i)?.value) }
        spec = next
        if (changed) litIndex = -1
        if (changed && hoverIndex != -1) { hoverIndex = -1; tooltip = null }
        val armed = pendingDrill
        pendingDrill = null
        render()
        val resolved = spec?.let { chartResolveIntro(it.animation, it.animationDuration, null).first } ?: "none"
        if (armed != null && resolved != "none" && !reducedMotion) { drillRun = armed; drillStart = now() }
        syncKeyboardCursor()
    }

    private fun jsEq(a: Double, b: Double?) = b != null && a == b

    fun resize() = render()
    fun replay() { introToken++; render() }

    /** Coming out of `loading` re-runs applyEngine (it is a watched prop). */
    fun loadingChanged() = applyEngine()

    private fun render() {
        val s = spec ?: return
        s.highlightIndex = if (hoverIndex >= 0) hoverIndex else if (hoverT > 0) litIndex else -1
        s.highlightT = hoverT
        scene = layout(s)
        onRender()
    }

    /** md-pie-chart drill(): arm a drill out of (`down`) / back into (`up`) the wedge at `index`; the next data swap plays it. */
    fun drill(index: Int, direction: String = "down") { pendingDrill = scene?.let { Triple(index, direction == "up", it) } }

    /** The drill in flight at `now`, or null (then draw `drawnScene()`). */
    fun drillFrame(now: Double): ChartPieDrillFrame? {
        val run = drillRun ?: return null
        val target = scene ?: return null
        val t = (now - drillStart) / CHART_DRILL_MS
        if (t >= 1) { drillRun = null; return null }
        fun centreOf(sc: ChartScene) = (sc.slices.firstOrNull { it.dataIndex >= 0 } ?: sc.slices.firstOrNull())?.let { it.cx to it.cy }
        val liveC = centreOf(target); val frozenC = centreOf(run.third)
        val frozen = if (liveC != null && frozenC != null && (liveC.first != frozenC.first || liveC.second != frozenC.second))
            run.third.copy(slices = run.third.slices.map { it.copy(cx = it.cx + liveC.first - frozenC.first, cy = it.cy + liveC.second - frozenC.second) }) else run.third
        val outer = if (run.second) target else frozen
        val inner = if (run.second) frozen else target
        val eased = chartEaseInOutCubic(t)
        val split = chartSplitScene(outer, inner, run.first, if (run.second) 1 - eased else eased) ?: run { drillRun = null; return null }
        return ChartPieDrillFrame(withRipple(split.first, now), split.second, split.third, t)
    }

    // ── per-frame state: hover rim tween, pick slide, ripple ──

    fun tick(now: Double) {
        var dirty = false
        hoverTween?.let { (t0, from, target) ->
            val p = min(1.0, (now - t0) / HOVER_TWEEN_MS)
            hoverT = from + (target - from) * chartExpressiveEase(p)
            if (p >= 1) hoverTween = null
            dirty = true
        }
        selectTween?.let { (t0, from, to) ->
            val p = min(1.0, (now - t0) / SELECT_MS)
            val e = chartExpressiveEase(p)
            spec = spec?.let { s -> s.copy(data = s.data.mapIndexed { i, d -> d.copy(selectT = from[i] + (to[i] - from[i]) * e) }).also { c -> c.highlightIndex = s.highlightIndex; c.highlightT = s.highlightT; c.legendExtent = s.legendExtent } }
            if (p >= 1) selectTween = null
            dirty = true
        }
        if (ripple != null && (now - ripple!!.second) / RIPPLE_MS >= 1) ripple = null
        if (dirty) render()
    }

    val animating get() = hoverTween != null || selectTween != null || ripple != null || drillRun != null

    /** The scene as drawn right now (the ripple stamped on). */
    fun drawnScene(now: Double = now()): ChartScene? = scene?.let { withRipple(it, now) }

    private fun withRipple(s: ChartScene, now: Double): ChartScene {
        val (r, start) = ripple ?: return s
        val t = min(1.0, (now - start) / RIPPLE_MS)
        return s.copy(ripple = r.copy(radius = rippleMax * chartEaseOutCubic(t), alpha = RIPPLE_ALPHA * (1 - max(0.0, (t - 0.35) / 0.65))))
    }

    private fun tweenHover() {
        val target = if (hoverIndex >= 0) 1.0 else 0.0
        if (hoverIndex >= 0) litIndex = hoverIndex
        if (reducedMotion) { hoverT = target; hoverTween = null; render(); return }
        hoverTween = null
        if (hoverT == target) { render(); return }
        hoverTween = Triple(now(), hoverT, target)
    }

    // ── tooltip ──

    private fun renderTooltip(idx: Int, px: Double, py: Double) {
        tooltip = null
        val s = spec ?: return
        if (idx < 0 || scene == null) return
        val datum = s.data.getOrNull(idx) ?: return
        fun ringTotal(d: ChartPieDatum) = s.data.fold(0.0) { sum, o -> if (o.hidden || o.level != d.level || o.parent != d.parent) sum else sum + o.value }
        val total = ringTotal(datum)
        val percent = if (total > 0) (datum.value / total) * 100 else 0.0
        val r = renderer
        if (r != null) {
            val series = s.data.mapIndexed { i, d ->
                val t = if (i == idx) total else ringTotal(d)
                ChartTooltipSeries(i, d.label, d.color, d.value, s.valueFormatter(d.value), i == idx, false, if (t > 0) (d.value / t) * 100 else 0.0)
            }
            when (val c = r(ChartTooltipContext(idx, ChartAxisValue.Str(datum.label), datum.label, series, emptyList(), idx))) {
                is ChartTooltipContent.Text -> tooltip = ChartPieTooltip(idx, null, null, null, c.text, px, py)
                else -> {}
            }
            return
        }
        // The card's share: one decimal, always (spec.percentFormatter); the announcement drops a trailing .0.
        tooltip = ChartPieTooltip(idx, datum.label, "${s.valueFormatter(datum.value)} (${ChartIntl.number(percent, locale, 1, 1)}%)", datum.color, null, px, py)
    }

    /** pie-chart.ts `placeTooltip` for the measured card. */
    fun tooltipOrigin(tw0: Double, th0: Double): Pair<Double, Double>? {
        val t = tooltip ?: return null
        val s = scene ?: return null
        // offsetWidth / offsetHeight: whole pixels.
        val tw = if (jsRound(tw0) > 0) jsRound(tw0) else 120.0; val th = if (jsRound(th0) > 0) jsRound(th0) else 40.0
        var left = t.anchorX + 14
        if (left + tw > s.width - 4) left = t.anchorX - tw - 14
        val top = max(4.0, min(t.anchorY - th / 2, s.height - th - 4))
        return max(4.0, left) to top
    }

    // ── pointer ──

    fun pointerMove(px: Double, py: Double) {
        val s = scene ?: return
        val slice = chartPieSliceAt(s, px, py)
        val idx = slice?.dataIndex ?: -1
        pointerCursor = slice != null
        if (idx != hoverIndex) { hoverIndex = idx; tweenHover() }
        renderTooltip(idx, px, py)
    }

    fun pointerLeave() {
        tooltip = null
        if (hoverIndex != -1) { hoverIndex = -1; pointerCursor = false; tweenHover() }
    }

    fun pointerDown(px: Double, py: Double) { val s = scene ?: return; chartPieSliceAt(s, px, py)?.let { startRipple(px, py, it) } }

    fun pointerUp(px: Double, py: Double) {
        val s = scene ?: return
        val slice = chartPieSliceAt(s, px, py) ?: return
        emitSliceClick(slice.dataIndex)
        toggleSelected(slice.dataIndex)
    }

    private fun startRipple(x: Double, y: Double, slice: ChartSceneSlice) {
        if (reducedMotion) return
        val corners = listOf(slice.startAngle, slice.endAngle).flatMap { a -> listOf(slice.innerR, slice.outerR).map { r -> hypot(slice.cx + cos(a) * r - x, slice.cy + sin(a) * r - y) } }
        rippleMax = max(corners.maxOrNull() ?: 1.0, 1.0)
        ripple = ChartSceneRipple(slice.dataIndex, x, y, 0.0, chartOnColor(slice.color), RIPPLE_ALPHA) to now()
    }

    private fun toggleSelected(index: Int) {
        val s = spec ?: return
        if (index !in s.data.indices) return
        val from = s.data.map { it.selectT ?: (if (it.selected == true) 1.0 else 0.0) }
        val wasOut = s.data[index].selected == true
        val flagged = s.data.mapIndexed { i, d -> d.copy(selected = i == index && !wasOut) }
        val to = flagged.map { if (it.selected == true) 1.0 else 0.0 }
        fun keep(n: ChartPieSpec) = n.also { it.highlightIndex = s.highlightIndex; it.highlightT = s.highlightT; it.legendExtent = s.legendExtent }
        spec = keep(s.copy(data = flagged))
        if (from.withIndex().all { (i, v) -> v == to[i] }) return
        if (reducedMotion) { spec = keep(spec!!.copy(data = flagged.mapIndexed { i, d -> d.copy(selectT = to[i]) })); render(); return }
        selectTween = Triple(now(), from, to)
    }

    // ── keyboard ──

    fun keyDown(key: String): Boolean {
        val nav = navigable()
        if (nav.isEmpty()) return false
        val first = nav.first(); val last = nav.last()
        val forward = if (rtl) "ArrowLeft" else "ArrowRight"; val back = if (rtl) "ArrowRight" else "ArrowLeft"
        val next: Int = when (key) {
            forward, "ArrowDown" -> if (kbIndex < 0) first else nav.firstOrNull { it > kbIndex } ?: last
            back, "ArrowUp" -> if (kbIndex < 0) last else nav.lastOrNull { it < kbIndex } ?: first
            "Home" -> first
            "End" -> last
            "Escape" -> { if (kbIndex < 0) return false; -1 }
            "Enter", " " -> {
                if (kbIndex < 0 || kbIndex !in nav) return false
                emitSliceClick(kbIndex)
                activate(kbIndex)
                return true
            }
            else -> return false
        }
        moveKeyboardCursor(next)
        return true
    }

    fun blur() { if (kbIndex >= 0) moveKeyboardCursor(-1) }

    private fun activate(index: Int) {
        val slice = scene?.slices?.firstOrNull { it.pill != true && it.dataIndex == index } ?: return
        val mid = (slice.startAngle + slice.endAngle) / 2; val r = (slice.innerR + slice.outerR) / 2
        startRipple(slice.cx + cos(mid) * r, slice.cy + sin(mid) * r, slice)
        toggleSelected(index)
    }

    private fun focusIndex(index: Int) {
        val s = scene ?: return
        if (index < 0) { tooltip = null; if (hoverIndex != -1) { hoverIndex = -1; tweenHover() }; return }
        val slice = s.slices.firstOrNull { it.dataIndex == index }
        if (slice == null) { tooltip = null; if (hoverIndex != -1) { hoverIndex = -1; tweenHover() }; return }
        if (hoverIndex != index) { hoverIndex = index; tweenHover() }
        // Anchored on the slice as it was before the hover re-render (pie-chart.ts reads it first).
        val mid = (slice.startAngle + slice.endAngle) / 2; val r = (slice.innerR + slice.outerR) / 2
        renderTooltip(index, slice.cx + cos(mid) * r, slice.cy + sin(mid) * r)
    }

    private fun syncKeyboardCursor() {
        if (kbIndex < 0) return
        val nav = navigable()
        if (kbIndex in nav) return
        moveKeyboardCursor(nav.firstOrNull { it > kbIndex } ?: nav.lastOrNull() ?: -1)
    }

    private fun moveKeyboardCursor(next: Int) {
        kbIndex = next
        focusIndex(next)
        if (next < 0) { announcement = ""; return }
        val es = entries()
        val e = es.getOrNull(next) ?: return
        val value = num(e.d["value"])
        val total = es.fold(0.0) { acc, o -> if (o.parent == e.parent && !o.hidden) acc + num(o.d["value"]) else acc }
        val pct = if (total > 0) (value / total) * 100 else 0.0
        val label = e.d["label"]?.let { chartJsString(it) } ?: "undefined"
        announcement = chartJsReplaceFirst(chartJsReplaceFirst(chartJsReplaceFirst(labelPoint, "%label%", label), "%value%", formatValue(value)), "%percent%", formatPercent(pct))
    }

    // ── legend + events ──

    fun legendToggle(index: Int) {
        val s = spec ?: return
        val d = s.data.getOrNull(index) ?: return
        val nh = !d.hidden
        spec = s.copy(data = s.data.mapIndexed { i, o -> if (i == index) o.copy(hidden = nh) else o }).also { it.highlightIndex = s.highlightIndex; it.highlightT = s.highlightT; it.legendExtent = s.legendExtent }
        introToken++
        render()
        chartPieDatumKeys(flatDatums()).getOrNull(index)?.let { legendHidden[it] = nh }
        syncKeyboardCursor()
        emit("mdLegendClick", mapOf("dataIndex" to index, "selected" to !nh))
    }

    private fun emitSliceClick(index: Int) {
        val d = flatDatums().getOrNull(index) ?: return
        val m = LinkedHashMap<String, Any?>()
        m["seriesIndex"] = 0
        d["id"]?.let { m["seriesId"] = it }
        m["dataIndex"] = index
        m["value"] = d["value"]
        m["series"] = d
        emit("mdSliceClick", m)
    }
}
