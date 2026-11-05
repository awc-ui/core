package dev.awc.nativeui.charts

import kotlin.math.max
import kotlin.math.min

// Port of the pure parts of engine/hover.ts: what the hover layer shows for an index, and where the tooltip goes.

data class ChartTooltipSeries(val seriesIndex: Int, val label: String, val color: String, val value: Double?, val formattedValue: String, val focused: Boolean, val missing: Boolean, val percent: Double? = null)
data class ChartTooltipContext(val dataIndex: Int, val axisValue: ChartAxisValue?, val axisLabel: String, val series: List<ChartTooltipSeries>, val missing: List<ChartTooltipSeries>, val focusedSeriesIndex: Int)
/** A renderer returns None for "no tooltip here", Text for plain content, or Default to keep the built-in card. */
sealed class ChartTooltipContent { object None : ChartTooltipContent(); data class Text(val text: String) : ChartTooltipContent(); object Default : ChartTooltipContent() }

data class ChartHoverRow(val color: String?, val label: String, val value: String)
data class ChartHoverMarkerModel(val symbol: String?, val color: String, val x: Double, val y: Double, val dimmed: Boolean)
data class ChartRectD(val x: Double, val y: Double, val w: Double, val h: Double)
data class ChartHoverModel(val index: Int, val orient: String, val line: ChartRectD?, val markers: List<ChartHoverMarkerModel>, val header: String, val rows: List<ChartHoverRow>, val customText: String?, val cursorX: Double, val cursorY: Double, val pos: Double)

fun chartHoverModel(scene: ChartScene, index: Int, yFormatter: (Double) -> String, cursorX: Double, cursorY: Double, orient: String, focusSeries: Int,
                    trigger: String, missingFormatter: ((Double?) -> String)?, renderer: ((ChartTooltipContext) -> ChartTooltipContent)?): ChartHoverModel? {
    if (index < 0 || index >= scene.xPositions.size) return null
    val pos = scene.xPositions[index]
    val plot = scene.plot
    var lo = if (orient == "horizontal") plot.x else plot.y
    var hi = lo + (if (orient == "horizontal") plot.width else plot.height)
    if (orient != "none") for (hp in scene.hoverPoints) { val pt = hp.byIndex[index] ?: continue; val v = if (orient == "horizontal") pt.x else pt.y; lo = min(lo, v); hi = max(hi, v) }
    val line = when (orient) { "none" -> null; "horizontal" -> ChartRectD(lo, pos - 0.5, hi - lo, 1.0); else -> ChartRectD(pos - 0.5, lo, 1.0, hi - lo) }
    val markers = mutableListOf<ChartHoverMarkerModel>(); val rows = mutableListOf<ChartHoverRow>()
    val present = mutableListOf<ChartTooltipSeries>(); val absent = mutableListOf<ChartTooltipSeries>()
    val itemOnly = trigger == "item" && focusSeries >= 0
    for (hp in scene.hoverPoints) {
        if (itemOnly && hp.seriesIndex != focusSeries) continue
        val format = hp.valueFormat ?: yFormatter
        val focused = hp.seriesIndex == focusSeries
        val p = hp.byIndex[index]
        if (p != null) {
            val swatch = p.color ?: hp.color
            if (hp.unanchored != true && orient != "none") markers.add(ChartHoverMarkerModel(p.symbol, swatch, p.x, p.y, focusSeries >= 0 && !focused))
            val value = if (p.low != null && p.high != null) "${format(p.low)} – ${format(p.high)}" else format(p.value)
            rows.add(ChartHoverRow(swatch, hp.label, value))
            if (renderer != null) present.add(ChartTooltipSeries(hp.seriesIndex, hp.label, hp.color, p.value, value, focused, false))
            continue
        }
        if (renderer == null && missingFormatter == null) continue
        val text = missingFormatter?.invoke(null) ?: ""
        if (renderer != null) absent.add(ChartTooltipSeries(hp.seriesIndex, hp.label, hp.color, null, text, focused, true))
        if (text.isNotEmpty()) rows.add(ChartHoverRow(null, hp.label, text))
    }
    val header = scene.xLabels.getOrElse(index) { "" }
    var custom: String? = null
    if (renderer != null) {
        when (val c = renderer(ChartTooltipContext(index, scene.xValues.getOrNull(index), header, present, absent, focusSeries))) {
            is ChartTooltipContent.None -> return ChartHoverModel(index, orient, line, markers, header, emptyList(), null, cursorX, cursorY, pos)
            is ChartTooltipContent.Text -> custom = c.text
            is ChartTooltipContent.Default -> {}
        }
    }
    return ChartHoverModel(index, orient, line, markers, header, rows, custom, cursorX, cursorY, pos)
}

/** hover.ts `positionTooltip`. */
fun chartTooltipOrigin(scene: ChartScene, tw0: Double, th0: Double, cursorX: Double, cursorY: Double, orient: String, pos: Double, rtl: Boolean): Pair<Double, Double> {
    val tw = if (tw0 > 0) tw0 else 120.0; val th = if (th0 > 0) th0 else 60.0
    if (th + 8 > scene.height) {
        val fits = tw + 8 <= scene.width
        val l = if (fits) max(4.0, min(cursorX - tw / 2, scene.width - tw - 4)) else max(24 - tw, min(cursorX - tw / 2, scene.width - 24))
        return jsRound(l) to jsRound(scene.plot.y + scene.plot.height + 6)
    }
    var left: Double; var top: Double
    when (orient) {
        "none" -> {
            left = cursorX + 14; if (left + tw > scene.width - 4) left = cursorX - tw - 14
            left = max(4.0, min(left, scene.width - tw - 4))
            top = cursorY + 14; if (top + th > scene.height - 4) top = cursorY - th - 14
            top = max(4.0, min(top, scene.height - th - 4))
        }
        "horizontal" -> {
            top = pos + 14; if (top + th > scene.height - 4) top = pos - th - 14
            top = max(4.0, top)
            left = if (rtl) max(4.0, min(cursorX - tw - 14, scene.width - tw - 4)) else max(4.0, min(cursorX + 14, scene.width - tw - 4))
        }
        else -> {
            left = if (rtl) pos - tw - 14 else pos + 14
            if (if (rtl) left < 4 else left + tw > scene.width - 4) left = if (rtl) pos + 14 else pos - tw - 14
            left = max(4.0, min(left, scene.width - tw - 4))
            top = max(4.0, min(cursorY - th / 2, scene.height - th - 4))
        }
    }
    return left to top
}

private val popEase = chartCubicBezier(0.2, 0.0, 0.0, 1.0)
/** The hover marker pop: scale 0.4 → 1.25 → 0.94 → 1 at 0/45/72/100 % over 320 ms (iteration easing cubic-bezier(0.2, 0, 0, 1)). */
fun chartPopScale(elapsedMs: Double): Double {
    if (elapsedMs >= 320) return 1.0
    val p = popEase(max(0.0, elapsedMs / 320))
    val keys = listOf(0.0 to 0.4, 0.45 to 1.25, 0.72 to 0.94, 1.0 to 1.0)
    for (k in 1 until keys.size) if (p <= keys[k].first) { val a = keys[k - 1]; val b = keys[k]; return a.second + (b.second - a.second) * (p - a.first) / (b.first - a.first) }
    return 1.0
}

/** md-line-chart / md-area-chart keyboard cursor (reading-direction arrows, Home/End, Escape). Returns null when the key is not handled. */
fun chartKeyboardNext(key: String, current: Int, last: Int, rtl: Boolean): Int? {
    val forward = if (rtl) "ArrowLeft" else "ArrowRight"; val back = if (rtl) "ArrowRight" else "ArrowLeft"
    return when (key) {
        forward -> if (current < 0) 0 else min(last, current + 1)
        back -> if (current < 0) last else max(0, current - 1)
        "Home" -> 0
        "End" -> last
        "Escape" -> if (current < 0) null else -1
        else -> null
    }
}

/** The `label-point` announcement for a keyboard index. */
fun chartPointAnnouncement(template: String, xText: String, values: List<Pair<String, String>>): String =
    template.replace("%x%", xText).replace("%values%", values.joinToString(", ") { "${it.first} ${it.second}" })
