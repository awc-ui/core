package dev.awc.nativeui.charts

import dev.awc.nativeui.AWCValue
import dev.awc.nativeui.awcList
import dev.awc.nativeui.awcMap
import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.cos
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin
import kotlin.math.sqrt

// Port of engine/pie-layout.ts plus md-pie-chart's spec building (flatten, harmonic palette).

data class ChartPieDatum(
    val label: String, val value: Double, val color: String, val hidden: Boolean = false, val selected: Boolean? = null, val selectT: Double? = null,
    val radius: Double? = null, val level: Int = 0, val parent: Int? = null,
)

data class ChartPieSpec(
    val data: List<ChartPieDatum>, val title: String? = null, val subtitle: String? = null, val titleAlign: String? = null,
    val innerRadius: AWCValue, val outerRadius: AWCValue, val startAngleDeg: Double, val endAngleDeg: Double, val paddingAngleDeg: Double, val cornerRadius: Double,
    val showLabels: Boolean, val highlight: String, val legend: String? = null, val valueFormatter: (Double) -> String,
    var highlightIndex: Int? = null, var highlightT: Double? = null, val gradient: Boolean? = null, val labelMode: String? = null,
    val sliceStroke: String? = null, val sliceStrokeWidth: Double? = null, val ringWidths: List<Double>? = null, var legendExtent: Double? = null,
    val animation: String? = null, val animationDuration: Double? = null,
)

const val PIE_SELECT_OFFSET = 12.0
private const val LABEL_CHAR_W = 0.52
private const val INNER_RING_WEIGHT = 1.45
private const val LABEL_MIN_SWEEP_INSIDE = 0.12
private const val LABEL_MIN_SWEEP_LEADER = 0.02
private const val HOVER_RIM = 7.0
private const val HOVER_GAP = 3.0
private const val RIM_ROOM = HOVER_RIM + HOVER_GAP
private const val LEVEL_GAP = 3.0
private const val FADE_STAGGER = 0.45
private const val DEG = Math.PI / 180

private data class Box(val x0: Double, val x1: Double, val y0: Double, val y1: Double)

private fun sectorBox(a0: Double, sweep: Double, holeFrac: Double): Box {
    val a1 = a0 + sweep; val lo = min(a0, a1); val hi = max(a0, a1)
    val xs = mutableListOf<Double>(); val ys = mutableListOf<Double>()
    for (a in listOf(lo, hi)) for (r in listOf(1.0, holeFrac)) { xs.add(cos(a) * r); ys.add(sin(a) * r) }
    val q = Math.PI / 2
    var k = ceil(lo / q).toInt()
    while (k * q <= hi) { xs.add(cos(k * q)); ys.add(sin(k * q)); k++ }
    return Box(xs.min(), xs.max(), ys.min(), ys.max())
}

private fun isAncestor(data: List<ChartPieDatum>, idx: Int, of: Int): Boolean {
    var cur = of; var guard = 0
    while (cur >= 0 && guard++ < 32) { if (cur == idx) return true; cur = data.getOrNull(cur)?.parent ?: -1 }
    return false
}
private fun sameFamily(data: List<ChartPieDatum>, a: Int, b: Int) = isAncestor(data, a, b) || isAncestor(data, b, a)

private fun sliceLabel(d: ChartPieDatum, spec: ChartPieSpec, fallback: String): String {
    val mode = spec.labelMode ?: fallback
    val value = spec.valueFormatter(d.value)
    return when (mode) { "name" -> d.label; "both" -> "${d.label} · $value"; else -> value }
}

private fun labelColorFor(fill: String): String { val c = chartParseColor(fill); return if (0.299 * c.r + 0.587 * c.g + 0.114 * c.b > 0.62) "rgba(0, 0, 0, 0.82)" else "#ffffff" }

private fun resolveRadius(r: AWCValue, baseR: Double): Double {
    if (r is Number) { val d = r.toDouble(); return if (d.isFinite() && d >= 0) d else 0.0 }
    val s = chartJsString(r).trim()
    val n = jsParseFloat(s)
    if (!n.isFinite() || n < 0) return 0.0
    return if (s.endsWith("%")) (n / 100) * baseR else n
}

fun chartComputePieLayout(spec: ChartPieSpec, theme: ChartEngineTheme, width: Double, height: Double): ChartScene {
    data class V(val d: ChartPieDatum, val i: Int)
    val visible = spec.data.mapIndexed { i, d -> V(d, i) }.filter { !it.d.hidden && it.d.value > 0 && it.d.level == 0 }
    val total = visible.sumOf { it.d.value }
    val depth = spec.data.fold(1) { m, d -> max(m, d.level + 1) }
    val titleH = if (!spec.title.isNullOrEmpty()) theme.titleSize + 12 + (if (!spec.subtitle.isNullOrEmpty()) theme.labelSize + 4 else 0.0) else 0.0
    val legendPos = if (!spec.legend.isNullOrEmpty() && spec.legend != "none" && spec.data.size > 1) spec.legend else null
    val maxLegendW = if (legendPos != null) jsMax(0.0, spec.data.map { chartApproxWidth(it.label, theme.labelSize) }) else 0.0
    var padL = 8.0; var padR = 8.0; var padT = 8 + titleH; var padB = 8.0
    if (legendPos != null) {
        if (legendPos == "left" || legendPos == "right") {
            val want = if (spec.legendExtent != null) spec.legendExtent!! + 16 else maxLegendW + 30
            val w = min(want, width * LEGEND_SIDE_MAX_FRACTION)
            if (legendPos == "left") padL += w else padR += w
        } else {
            var band = if (spec.legendExtent != null) spec.legendExtent!! + 8 else 0.0
            if (spec.legendExtent == null) {
                val availW = max(60.0, width * 0.86)
                var rows = 1; var rowW = 0.0
                for (d in spec.data) { val iw = chartApproxWidth(d.label, theme.labelSize) + 28; if (rowW > 0 && rowW + iw > availW) { rows++; rowW = iw } else rowW += iw }
                band = rows * (theme.labelSize + 8) + 6
            }
            if (legendPos.startsWith("bottom")) padB += band else padT += band
        }
    }
    val plot = ChartRect(padL, padT, max(1.0, width - padL - padR), max(1.0, height - padT - padB))
    val startRad = -spec.startAngleDeg * DEG
    val sweepTotal = -(spec.endAngleDeg - spec.startAngleDeg) * DEG
    val holeFrac = run { val inner = resolveRadius(spec.innerRadius, 100.0); val outer = resolveRadius(spec.outerRadius, 100.0); if (outer > 0) max(0.0, min(0.95, inner / outer)) else 0.0 }
    val partial = abs(sweepTotal) < Math.PI * 2 - 0.02
    val box = if (partial) sectorBox(startRad, sweepTotal, holeFrac) else Box(-1.0, 1.0, -1.0, 1.0)
    val baseR = max(1.0, min(plot.width / max(0.01, box.x1 - box.x0), plot.height / max(0.01, box.y1 - box.y0)))
    val cx = plot.x + plot.width / 2 - ((box.x0 + box.x1) / 2) * baseR
    val cy = plot.y + plot.height / 2 - ((box.y0 + box.y1) / 2) * baseR
    val labelRoom = run {
        if (!spec.showLabels || legendPos != null) return@run 6.0
        val longest = visible.fold(0) { m, v -> max(m, sliceLabel(v.d, spec, "both").length) }
        val want = resolveRadius(spec.outerRadius, baseR)
        val textW = 12 + longest * theme.labelSize * LABEL_CHAR_W
        val f = max(0.05, want / max(1.0, baseR))
        max(6.0, min(baseR * 0.45, (want + textW - baseR) / f))
    }
    val ringR = max(8.0, baseR - labelRoom)
    val outerR = max(1.0, min(resolveRadius(spec.outerRadius, ringR), ringR))
    val innerR = max(0.0, min(resolveRadius(spec.innerRadius, ringR), outerR - 2))
    val ringWeights = (0 until depth).map { level -> val w = spec.ringWidths?.getOrNull(level); if (w != null && w.isFinite() && w > 0) w else if (level < depth - 1) INNER_RING_WEIGHT else 1.0 }
    val weightSum = ringWeights.sum().let { if (it == 0.0) 1.0 else it }
    val bandSpan = outerR - innerR
    val levelGap = if (depth > 1) min(LEVEL_GAP, (bandSpan / depth) * 0.3) else 0.0
    val bandable = max(1.0, bandSpan - levelGap * (depth - 1))
    fun bandAt(level: Int) = (bandable * ringWeights[level]) / weightSum
    val ringStarts = mutableListOf<Double>(); run { var acc = innerR; for (level in 0 until depth) { ringStarts.add(acc); acc += bandAt(level) + (if (level < depth - 1) levelGap else 0.0) } }
    fun ringInner(level: Int) = ringStarts.getOrNull(level) ?: innerR
    fun ringOuter(level: Int) = ringInner(level) + bandAt(level)
    val span = HashMap<Int, Pair<Double, Double>>()
    val hasKids = spec.data.mapNotNull { d -> d.parent?.takeIf { it >= 0 } }.toSet()
    fun outerFor(level: Int, i: Int): Double {
        val full = if (i in hasKids) ringOuter(level) else outerR
        val r = spec.data.getOrNull(i)?.radius ?: return full
        val base = ringInner(level)
        return base + (full - base) * max(0.15, min(1.0, r))
    }
    val sign = if (sweepTotal >= 0) 1.0 else -1.0
    val totalPad = if (visible.isNotEmpty()) min(spec.paddingAngleDeg * DEG * visible.size, abs(sweepTotal) * 0.9) else 0.0
    val perPad = if (visible.isNotEmpty()) totalPad / visible.size else 0.0
    val availSweep = sweepTotal - sign * totalPad
    val slices = mutableListOf<ChartSceneSlice>(); val texts = mutableListOf<ChartTextItem>(); val leaders = mutableListOf<ChartSegment>()
    class Out(val key: String, val text: String, val x1: Double, val y1: Double, val x: Double, var y: Double, val right: Boolean)
    val outside = mutableListOf<Out>()
    var cursor = startRad
    val sepColor = spec.sliceStroke ?: theme.surface
    val sepWidth = if (visible.size > 1) (spec.sliceStrokeWidth ?: 1.0) else 0.0
    val hubCut = run {
        if (innerR > 0 || sepWidth <= 0 || visible.size < 2) return@run 0.0
        val g = sepWidth / 2
        val tot = visible.sumOf { max(0.0, it.d.value) }.let { if (it == 0.0) 1.0 else it }
        val fullSweep = abs(-(spec.endAngleDeg - spec.startAngleDeg) * DEG)
        var worst = 0.0
        for (v in visible) { val sw = (max(0.0, v.d.value) / tot) * fullSweep; if (sw > 0.001) worst = max(worst, g / sin(min(sw, Math.PI) / 2)) }
        minOf(worst, outerR * 0.04, 4.0)
    }
    val hi = max(0.0, min(1.0, spec.highlightT ?: 1.0))
    val hoverBands = mutableListOf<ChartSceneSlice>()
    fun pushBand(bx: Double, by: Double, rOut: Double, a0: Double, a1: Double, color: String) {
        val rimH = HOVER_RIM * hi; val gap = HOVER_GAP * hi
        val midR = rOut + gap + rimH / 2
        val dArc = (if (midR > 0) rimH / 2 / midR else 0.0) * sign
        hoverBands.add(ChartSceneSlice(bx, by, rOut + gap, rOut + gap + rimH, a0 + dArc, a1 - dArc, color, -1, pill = true))
    }
    val hovering = spec.highlight != "none" && spec.highlightIndex != null && spec.highlightIndex!! >= 0
    val midFrac = mutableListOf<Double>(); run { var acc = 0.0; for (v in visible) { val frac = if (total > 0) v.d.value / total else 0.0; midFrac.add(acc + frac / 2); acc += frac } }
    val hoveredPos = visible.indexOfFirst { it.i == spec.highlightIndex }
    val hoveredLevel = if (hovering) (spec.data.getOrNull(spec.highlightIndex ?: -1)?.level ?: 0).toDouble() else Double.POSITIVE_INFINITY
    fun fadeFor(pos: Int): Double {
        if (hoveredPos < 0) return hi
        val diff = abs(midFrac[pos] - midFrac[hoveredPos])
        val lag = min(diff, 1 - diff) * 2 * FADE_STAGGER
        return max(0.0, min(1.0, (hi - lag) / (if (1 - lag == 0.0) 1.0 else 1 - lag)))
    }
    val offOf = HashMap<Int, Pair<Double, Double>>()
    visible.forEachIndexed { pos, (d, i) ->
        val fade = fadeFor(pos)
        val frac = if (total > 0) d.value / total else 0.0
        val sliceSweep = availSweep * frac
        val a0 = cursor + (sign * perPad) / 2
        val a1 = a0 + sliceSweep
        cursor = a1 + (sign * perPad) / 2
        val mid = (a0 + a1) / 2
        val isHovered = hovering && (spec.highlightIndex == i || spec.highlight == "series")
        val litByFamily = hovering && sameFamily(spec.data, i, spec.highlightIndex ?: -1)
        val ex = (d.selectT ?: (if (d.selected == true) 1.0 else 0.0)) * PIE_SELECT_OFFSET
        val scx = cx + cos(mid) * ex; val scy = cy + sin(mid) * ex
        offOf[i] = (scx - cx) to (scy - cy)
        val fill = if (hovering && !isHovered && !litByFamily && fade > 0) chartMixColor(d.color, theme.surface, 0.62 * fade) else d.color
        if (isHovered && hi > 0) pushBand(scx, scy, outerFor(0, i), a0, a1, d.color)
        slices.add(ChartSceneSlice(scx, scy, max(ringInner(0), hubCut), outerFor(0, i), a0, a1, fill, i, null, spec.cornerRadius, sepWidth, sepColor,
            if (spec.gradient == true) chartMixColor(d.color, theme.surface, 0.3) to d.color else null))
        span[i] = a0 to a1
        val inside = legendPos != null || depth > 1
        if (spec.showLabels && abs(sliceSweep) > (if (inside) LABEL_MIN_SWEEP_INSIDE else LABEL_MIN_SWEEP_LEADER)) {
            if (inside) {
                val r0 = ringInner(0); val r1 = outerFor(0, i)
                val labelR = if (r0 > 0) (r0 + r1) / 2 else r1 * 0.62
                texts.add(ChartTextItem(scx + cos(mid) * labelR, scy + sin(mid) * labelR, sliceLabel(d, spec, if (depth > 1) "name" else "value"), labelColorFor(fill), theme.labelSize, null, "center", "middle", null, "pl-$i"))
            } else outside.add(Out("pl-$i", sliceLabel(d, spec, "both"), scx + cos(mid) * outerFor(0, i), scy + sin(mid) * outerFor(0, i), scx + cos(mid) * (outerR + 12), scy + sin(mid) * (outerR + 12), cos(mid) >= 0))
        }
    }
    for (level in 1 until depth) {
        val here = spec.data.mapIndexed { i, d -> V(d, i) }.filter { it.d.level == level && !it.d.hidden }
        val byParent = LinkedHashMap<Int, MutableList<V>>()
        for (x in here) byParent.getOrPut(x.d.parent ?: -1) { mutableListOf() }.add(x)
        for ((parentIdx, kids) in byParent) {
            val pSpan = span[parentIdx] ?: continue
            val sum = kids.sumOf { max(0.0, it.d.value) }
            if (sum <= 0) continue
            val sweepAll = pSpan.second - pSpan.first
            var cur = pSpan.first
            for ((d, i) in kids) {
                val a0 = cur; val a1 = a0 + sweepAll * (max(0.0, d.value) / sum); cur = a1
                span[i] = a0 to a1
                val shove = if (level > hoveredLevel) RIM_ROOM * hi else 0.0
                val rIn = ringInner(level) + shove; val rOut = outerFor(level, i) + shove
                val related = hoveredPos < 0 || spec.highlightIndex == i || sameFamily(spec.data, i, spec.highlightIndex ?: -1)
                val kex = (d.selectT ?: (if (d.selected == true) 1.0 else 0.0)) * PIE_SELECT_OFFSET
                val kmid = (a0 + a1) / 2
                val pOff = offOf[parentIdx] ?: (0.0 to 0.0)
                val ox = pOff.first + cos(kmid) * kex; val oy = pOff.second + sin(kmid) * kex
                offOf[i] = ox to oy
                slices.add(ChartSceneSlice(cx + ox, cy + oy, rIn, rOut, a0, a1, if (hovering && !related && hi > 0) chartMixColor(d.color, theme.surface, 0.62 * hi) else d.color, i, null,
                    spec.cornerRadius, sepWidth, sepColor, if (spec.gradient == true) chartMixColor(d.color, theme.surface, 0.3) to d.color else null))
                if (hovering && spec.highlightIndex == i && hi > 0) pushBand(cx + ox, cy + oy, rOut, a0, a1, d.color)
                val mid = (a0 + a1) / 2
                if (spec.showLabels && abs(a1 - a0) > LABEL_MIN_SWEEP_LEADER && level == depth - 1)
                    outside.add(Out("pl-$i", sliceLabel(d, spec, "both"), cx + ox + cos(mid) * rOut, cy + oy + sin(mid) * rOut, cx + ox + cos(mid) * (rOut + 12), cy + oy + sin(mid) * (rOut + 12), cos(mid) >= 0))
            }
        }
    }
    if (outside.isNotEmpty()) {
        val lineH = theme.labelSize * 1.45
        for (right in listOf(true, false)) {
            val col = outside.filter { it.right == right }.sortedBy { it.y }
            if (col.isEmpty()) continue
            for (k in 1 until col.size) if (col[k].y - col[k - 1].y < lineH) col[k].y = col[k - 1].y + lineH
            val over = col.last().y - (height - lineH / 2)
            if (over > 0) for (l in col) l.y -= over
            val under = lineH / 2 - col[0].y
            if (under > 0) for (l in col) l.y += under
        }
        for (l in outside) {
            val room = if (l.right) width - 6 - l.x else l.x - 6
            val fits = max(3, floor(room / (theme.labelSize * LABEL_CHAR_W)).toInt())
            val text = if (l.text.length > fits) l.text.substring(0, fits - 1) + "…" else l.text
            leaders.add(ChartSegment(l.x1, l.y1, l.x, l.y, theme.gridLineColor, 1.0))
            texts.add(ChartTextItem(l.x + (if (l.right) 3 else -3), l.y, text, theme.textColorMuted, theme.labelSize, null, if (l.right) "start" else "end", "middle", null, l.key))
        }
    }
    slices.addAll(hoverBands)
    if (!spec.title.isNullOrEmpty()) {
        val (tx, ta) = chartTitlePlacement(spec.titleAlign, 12.0, width - 24)
        texts.add(ChartTextItem(tx, 6.0, spec.title, theme.textColor, theme.titleSize, 600.0, ta, "top", null, "title"))
        if (!spec.subtitle.isNullOrEmpty()) texts.add(ChartTextItem(tx, 6 + theme.titleSize + 4, spec.subtitle, theme.textColorMuted, theme.labelSize, null, ta, "top", null, "subtitle"))
    }
    val legend = if (legendPos != null) spec.data.mapIndexed { i, d -> ChartLegendItem(d.label, d.color, i, d.hidden, 0.0, 0.0) } else emptyList()
    val h = if (partial) sectorBox(startRad, sweepTotal, 0.0) else Box(-1.0, 1.0, -1.0, 1.0)
    val k = innerR / sqrt(2.0)
    return ChartScene(null, width, height, plot, if (theme.background == "transparent") null else theme.background, null, leaders, emptyList(), emptyList(), emptyList(), slices, emptyList(), emptyList(),
        null, null, texts, null, legend, legendPos, ChartPt(cx + ((h.x0 + h.x1) / 2) * k, cy + ((h.y0 + h.y1) / 2) * k), ChartPt(cx, cy),
        if (innerR > 0) (h.x1 - h.x0) * k else 0.0, if (innerR > 0) (h.y1 - h.y0) * k else 0.0)
}

/** theme.ts `harmonicPalette`. */
fun chartHarmonicPalette(anchors: List<String>, n: Int, light: String, dark: String): List<String> {
    val usable = anchors.filter { it.isNotEmpty() }
    if (n <= 0 || usable.isEmpty()) return emptyList()
    if (usable.size == 1) return List(n) { usable[0] }
    val ramp = (0 until n).map { i ->
        if (n == 1) usable[0] else {
            val t = (i.toDouble() / (n - 1)) * (usable.size - 1)
            val lo = floor(t).toInt(); val hiI = min(usable.size - 1, lo + 1); val f = t - lo
            if (f == 0.0) usable[lo] else if (f == 1.0) usable[hiI] else chartMixColor(usable[lo], usable[hiI], f)
        }
    }
    if (n <= usable.size) return ramp
    return ramp.mapIndexed { i, c -> if (i % 2 == 0) c else chartMixColor(c, if (i % 4 == 1) dark else light, 0.22) }
}

fun chartMirrorLegend(pos: String): String = when (pos) { "left" -> "right"; "right" -> "left"; "top-start" -> "top-end"; "top-end" -> "top-start"; "bottom-start" -> "bottom-end"; "bottom-end" -> "bottom-start"; else -> pos }

fun chartPieDatumKeys(flat: List<Map<String, AWCValue>>): List<String> {
    val seen = HashMap<String, Int>()
    return flat.mapIndexed { i, d ->
        val base = if (d["id"] != null) "id:${chartJsString(d["id"])}" else if (d["label"] != null) "label:${chartJsString(d["label"])}" else "pos:$i"
        val n = seen[base] ?: 0; seen[base] = n + 1
        if (n == 0) base else "$base#$n"
    }
}

/** md-pie-chart `buildSpec` (+ `flatten`). */
fun chartBuildPieSpec(input: ChartCartesianInput, t: ChartTheme, rtl: Boolean): ChartPieSpec {
    val pr = input.props
    val dataValues = awcList(pr.obj("data")).map { awcMap(it) }
    val flat = mutableListOf<Map<String, AWCValue>>()
    fun walkFlat(items: List<Map<String, AWCValue>>) { for (d in items) { flat.add(d); walkFlat(awcList(d["children"]).map { awcMap(it) }) } }
    walkFlat(dataValues)
    val keys = chartPieDatumKeys(flat)
    val palette = chartHarmonicPalette(t.palette.take(3), dataValues.size, t.surface, t.textColor)
    val mono = pr.p["monochrome"]?.let { chartJsString(it) }
    val monoBase = if (mono != null) chartResolveSeriesColor(input.tokens, mono.ifEmpty { "primary" }, t.palette[0]) else null
    val out = mutableListOf<ChartPieDatum>()
    fun walk(items: List<Map<String, AWCValue>>, level: Int, parent: Int?, parentColor: String?) {
        items.forEachIndexed { i, d ->
            val base = when {
                parentColor != null -> chartMixColor(parentColor, t.surface, 0.18 + (i.toDouble() / max(1, items.size)) * 0.42)
                monoBase != null -> chartMixColor(monoBase, t.surface, (i.toDouble() / max(1, items.size)) * 0.7)
                else -> palette.getOrNull(i) ?: chartPickPaletteColor(t.palette, i)
            }
            val color = chartResolveSeriesColor(input.tokens, d.chartStr("color"), base)
            val at = out.size
            out.add(ChartPieDatum(d.chartStr("label") ?: "undefined", (d["value"] as? Number)?.toDouble() ?: Double.NaN, color, d.chartBool("hidden") ?: input.legendHidden[keys[at]] ?: false,
                d.chartBool("selected"), null, d.chartNum("radius"), level, parent))
            val kids = awcList(d["children"]).map { awcMap(it) }
            if (kids.isNotEmpty()) walk(kids, level + 1, at, color)
        }
    }
    walk(dataValues, 0, null, null)
    val locale = pr.str("locale", "")
    val vf = input.formatters.valueFormatter
    val label = pr.str("label", ""); val subtitle = pr.str("subtitle", "")
    val legend = pr.str("legend", "right")
    return ChartPieSpec(
        data = out, title = label.ifEmpty { null }, subtitle = subtitle.ifEmpty { null }, titleAlign = pr.str("titleAlign", "start"),
        innerRadius = pr.p["innerRadius"] ?: "0%", outerRadius = pr.p["outerRadius"] ?: "75%", startAngleDeg = pr.num("startAngle", 90.0), endAngleDeg = pr.num("endAngle", -270.0),
        paddingAngleDeg = pr.num("paddingAngle", 0.0), cornerRadius = pr.num("cornerRadius", 4.0), showLabels = pr.bool("showLabels", true),
        labelMode = pr.p["labelMode"]?.let { chartJsString(it) }, gradient = pr.bool("gradient"), highlight = pr.str("highlight", "slice"),
        legend = if (rtl) chartMirrorLegend(legend) else legend, ringWidths = pr.obj("ringWidths")?.let { awcList(it).mapNotNull { v -> (v as? Number)?.toDouble() } },
        valueFormatter = { v -> vf?.invoke(v) ?: ChartIntl.number(v, locale) },
        animation = if (pr.bool("noAnimation")) "none" else pr.str("animation", "expressive"), animationDuration = pr.num("animationDuration"),
    )
}
