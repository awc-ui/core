// GENERATED from the chart JVM harness (mk-atest.py) — do not edit here.
package dev.awc.playground.charts

import dev.awc.nativeui.charts.*
import java.io.File
import kotlin.math.abs

// Replays the Web interaction oracles (hover / keys / pointer) through ChartCartesianInteraction and compares
// events, live region, hover layer (index, crosshair, markers + dimming), tooltip text and position, and the
// scenes recorded after zoom / legend / runtime steps.

@Suppress("UNCHECKED_CAST")
fun <T> Any?.cast(): T = this as T
fun num(v: Any?) = (v as Number).toDouble()

class Replayer(val kind: String, val c: Map<String, Any?>, val reduced: Boolean) {
    val tag = "md-$kind-chart"
    val name = c["name"] as String
    val phases: List<Map<String, Any?>> = c["phases"].cast()
    val rtl = c["dir"] == "rtl"
    val cart = if (kind == "bar") null else ChartCartesianInteraction(kind == "area")
    val bar = if (kind == "bar") ChartBarInteraction() else null
    val ctl: ChartPlotInteraction = cart ?: bar!!
    var clock = 0.0
    val events = mutableListOf<Pair<Int, ChartEvent>>()
    var phaseIdx = 0
    val props: MutableMap<String, Any?>
    val inline: Map<String, String>
    val inherited: Double
    var w = 0.0; var h = 0.0
    var ox = 0.0; var oy = 0.0
    val fm = ChartFormatters()
    /** Web quirk: `density` is not a watched prop, so a runtime change re-lays-out (ResizeObserver) with the theme read at the last applyEngine. */
    var themeDensity: Double? = null

    init {
        val (p, i, inh) = parse(c["html"] as String, tag)
        c["props"].cast<Map<String, Any?>?>()?.forEach { (k, v) -> p[k] = v }
        props = p; inline = i; inherited = inh
        if (name.endsWith("formatter-locale")) fm.valueFormatter = { v -> if (v == null) "–" else ChartIntl.number(v, "de-DE") + " €" }
        if (name.endsWith("custom-renderer")) { val r: (ChartTooltipContext) -> ChartTooltipContent = { ctx -> ChartTooltipContent.Text("<b></b> custom (${ctx.series.size} rows)") }; cart?.renderer = r; bar?.renderer = r }
        ctl.now = { clock }
        ctl.reducedMotion = reduced
        ctl.rtl = rtl
        ctl.onEvent = { events.add(phaseIdx to it) }
        ctl.rebuild = { rebuild() }
        sizeFrom(phases[0])
        configure()
        ctl.applyEngine()
    }

    fun sizeFrom(p: Map<String, Any?>) {
        val r: Map<String, Any?> = p["snap"].cast<Map<String, Any?>>()["plot"].cast<Map<String, Any?>>()["rect"].cast()
        w = num(r["width"]); h = num(r["height"]); ox = num(r["x"]); oy = num(r["y"])
    }

    fun configure() {
        val pr = ChartProps(props)
        val series = (props["series"] as? List<*>)?.map { it.cast<Map<String, Any?>>() } ?: emptyList()
        val xAxis = props["xAxis"] as? Map<*, *>
        val xData = (xAxis?.get("data") as? List<*>)?.toList()
        cart?.let { c ->
            c.series = series; c.xAxisData = xData
            c.merged = chartNormalizeSeriesX(series.map { (it["data"] as? List<*>)?.toList() ?: emptyList() }, xData?.mapNotNull { chartAxisValue(it) }, ChartScaleType.of(xAxis?.get("scale") as? String) ?: ChartScaleType.CATEGORY)
            c.tooltip = pr.str("tooltip", "axis"); c.zoom = pr.str("zoom", "none"); c.locale = pr.str("locale", "")
            c.labelPoint = pr.str("labelPoint", "%x%: %values%"); c.formatters = fm; c.missingFormatter = fm.valueFormatter
        }
        bar?.let { b ->
            b.series = series; b.xAxisData = xData
            b.tooltip = pr.str("tooltip", "axis"); b.zoom = pr.str("zoom", "none"); b.locale = pr.str("locale", "")
            b.labelPoint = pr.str("labelPoint", "%x%: %values%"); b.formatters = fm; b.missingFormatter = fm.valueFormatter
            b.polar = pr.bool("polar"); b.horizontal = pr.str("layout", "vertical") == "horizontal"; b.clickable = pr.bool("clickable")
        }
    }

    fun rebuild() {
        val toks = tokens(c["theme"] == "dark"); toks.putAll(inline)
        val pr = ChartProps(props)
        val density = themeDensity ?: (pr.num("density")?.takeIf { it in listOf(-1.0, -2.0, -3.0, -4.0) } ?: inherited)
        val theme = chartReadTheme(toks, density)
        if (bar != null) {
            val spec = chartBuildBarSpec(ChartCartesianInput(tag, pr, toks, density, fm, ctl.zoomWindow(), bar.legendHidden, bar.hiddenOverride), theme)
            bar.valueFormatter = spec.valueFormatter
            bar.surface = theme.engine.surface
            ctl.scene = chartRenderBarScene(spec, theme.engine, w, h, rtl, ApproxMeasurer())
            return
        }
        val c = cart!!
        val spec = chartBuildCartesianSpec(ChartCartesianInput(tag, pr, toks, density, fm, ctl.zoomWindow(), c.legendHidden, c.hiddenOverride), theme)
        c.yFormatter = spec.yFormatter
        ctl.scene = chartRenderScene(spec, theme.engine, w, h, rtl, ApproxMeasurer())
    }

    // ── actions (canvas coordinates) ──
    fun s() = ctl.scene!!
    fun atIndex(i: Int, f: Double = 0.5) = s().xPositions[i] to s().plot.y + s().plot.height * f
    fun marker(si: Int, di: Int) = s().hoverPoints[si].byIndex.getValue(di).let { it.x to it.y }
    fun lineBetween(si: Int, di: Int): Pair<Double, Double> { val a = s().hoverPoints[si].byIndex.getValue(di); val b = s().hoverPoints[si].byIndex.getValue(di + 1); return a.x + (b.x - a.x) / 4 to a.y + (b.y - a.y) / 4 }
    fun barCentre(si: Int, di: Int): Pair<Double, Double> { val b = s().bars.firstOrNull { it.seriesIndex == si && it.dataIndex == di } ?: s().bars[0]; return b.x + b.w / 2 to b.y + b.h / 2 }
    fun sliceCentre(i: Int): Pair<Double, Double> { val sl = s().slices[i]; val a = (sl.startAngle + sl.endAngle) / 2; val r = (sl.innerR + sl.outerR) / 2; return sl.cx + kotlin.math.cos(a) * r to sl.cy + kotlin.math.sin(a) * r }
    fun areaInside(si: Int, di: Int): Pair<Double, Double> { val p = s().hoverPoints[si].byIndex.getValue(di); return p.x to (p.y + (s().areas[0].baselineY ?: (s().plot.y + s().plot.height))) / 2 }
    var inside = false
    /** Blink carries pointer positions as float32: quantise the page coordinate, then return to canvas space. */
    fun q(p: Pair<Double, Double>) = ((ox + p.first).toFloat().toDouble() - ox) to ((oy + p.second).toFloat().toDouble() - oy)
    fun move(p0: Pair<Double, Double>) {
        val p = q(p0)
        val insideNow = p.first >= 0 && p.second >= 0 && p.first <= w && p.second <= h
        if (!insideNow) { if (inside) ctl.pointerLeave(); inside = false; return }
        inside = true; ctl.pointerMove(p.first, p.second)
    }
    fun leave() { if (inside) ctl.pointerLeave(); inside = false }
    fun down(p0: Pair<Double, Double>) { move(p0); val p = q(p0); ctl.pointerDown(p.first, p.second, 0) }
    fun up(p0: Pair<Double, Double>) { val p = q(p0); ctl.pointerUp(p.first, p.second, inside) }
    fun click(p: Pair<Double, Double>) { down(p); up(p) }
    fun drag(from: Pair<Double, Double>, to: () -> Pair<Double, Double>) {
        val t = to()
        down(from)
        for (k in 1..8) { clock += 35; move(from.first + (t.first - from.first) * k / 8 to from.second + (t.second - from.second) * k / 8) }
        up(t)
    }
    fun dbl(p0: Pair<Double, Double>) { move(p0); val p = q(p0); ctl.pointerDown(p.first, p.second, 0); up(p0); ctl.pointerDown(p.first, p.second, 0); up(p0) }
    fun legendClick(i: Int) { leave(); ctl.legendToggle(i) }

    var sliderWin = 0 to 0
    fun steps(): List<() -> Unit> {
        val k = kind
        return when {
            name.contains("-hover-axis-") -> listOf({}, { move(atIndex(1)) }, { move(atIndex(3)) }, { move(atIndex(5)) }, { leave() })
            name == "bar-hover-item" -> listOf({ move(barCentre(0, 1)) }, { move(barCentre(1, 3)) }, { move(atIndex(2, 0.02)) }, { leave() })
            name == "bar-hover-horizontal" -> listOf({}, { move(s().plot.x + s().plot.width / 2 to s().xPositions[1]) }, { move(s().plot.x + s().plot.width / 2 to s().xPositions[4]) }, { leave() })
            name == "bar-keys-horizontal" -> listOf({}, { ctl.keyDown("ArrowDown") }, { ctl.keyDown("ArrowRight") }, { ctl.keyDown("ArrowUp") }, { ctl.keyDown("Enter") })
            name == "bar-click" -> listOf({ click(barCentre(0, 1)) }, { click(barCentre(1, 4)) }, { click(atIndex(2, 0.02)) }, { click(s().plot.x + 2 to s().plot.y + s().plot.height - 2) })
            name == "bar-click-horizontal" -> listOf({ click(barCentre(0, 2)) })
            name == "bar-click-negative" -> listOf({ click(barCentre(0, 1)) })
            name == "bar-click-stacked" -> listOf({ click(barCentre(2, 3)) })
            name == "bar-click-polar" -> listOf({ click(sliceCentre(1)) })
            name.endsWith("-hover-item") -> listOf({ move(marker(0, 1)) }, { move(marker(1, 3)) }, { move(atIndex(2, 0.02)) }, { leave() })
            name.endsWith("-hover-tooltip-none") || name.endsWith("-custom-renderer") || name.endsWith("-hover-stacked") -> listOf({ move(atIndex(2)) }, { leave() })
            name.endsWith("-formatter-locale") -> listOf({ move(atIndex(0)) }, { leave() })
            name.endsWith("-keys-ltr") || name.endsWith("-keys-rtl") || name.endsWith("-keys-label-point") -> {
                val all = listOf<() -> Unit>({}, { ctl.keyDown("ArrowRight") }, { ctl.keyDown("ArrowRight") }, { ctl.keyDown("End") }, { ctl.keyDown("ArrowRight") },
                    { ctl.keyDown("Home") }, { ctl.keyDown("ArrowLeft") }, { ctl.keyDown("ArrowDown") }, { ctl.keyDown("ArrowRight") },
                    { ctl.keyDown("Enter") }, { ctl.keyDown(" ") }, { ctl.keyDown("Escape") }, { ctl.keyDown("ArrowRight") }, { ctl.blur() })
                if (name.endsWith("label-point")) all.take(3) else all
            }
            name.endsWith("-keys-zoomed") -> listOf({}, { ctl.keyDown("Home") }, { ctl.keyDown("End") }, { ctl.keyDown("ArrowRight") }, { ctl.keyDown("Enter") })
            name.endsWith("-keys-inverted") -> listOf({}, { ctl.keyDown("ArrowRight") }, { ctl.keyDown("ArrowDown") })
            name.endsWith("-keys-legend") -> listOf({}, { ctl.blur() }, { ctl.legendToggle(0) }, {}, { ctl.legendToggle(1) }, {}, { ctl.legendToggle(0) })
            name.endsWith("-keys-empty") -> listOf({})
            name == "$k-click" -> listOf({ click(marker(0, 1)) }, { click(lineBetween(0, 2)) }, { click(atIndex(3, 0.02)) })
            name == "$k-click-area" -> listOf({ click(areaInside(0, 2)) })
            name.endsWith("-legend-pointer") -> listOf({ leave() }, { legendClick(1) }, { move(atIndex(2)) }, { legendClick(1) }, { leave() })
            name.endsWith("-zoom-inside") -> listOf({ drag(atIndex(1)) { atIndex(4) } }, { move(atIndex(2)) }, { val f = atIndex(2, 0.4); drag(f) { atIndex(1, 0.4) } },
                { val f = atIndex(0); drag(f) { s().xPositions[0] + 4 to s().plot.y + s().plot.height / 2 } }, { dbl(atIndex(0, 0.1)) })
            name.endsWith("-zoom-inside-rtl") -> listOf({ drag(atIndex(1)) { atIndex(4) } }, { dbl(atIndex(1, 0.1)) })
            name.endsWith("-zoom-slider") -> listOf({}, {}, { val w = ctl.win(); ctl.zoomSliderInput(w.first + 1.0, w.second.toDouble()) }, { val w = ctl.win(); ctl.zoomSliderInput(w.first + 1.0, w.second.toDouble()) },
                {}, { val w = ctl.win(); ctl.zoomSliderInput(w.first.toDouble(), w.second - 1.0) }, { ctl.setZoom(0.0, 2.0) }, { ctl.resetZoom() })
            name.endsWith("-runtime") -> listOf({}, { ctl.loadingChanged(true, false) }, { ctl.loadingChanged(false, true) },
                { props["series"] = emptyList<Any?>(); configure(); ctl.applyEngine() },
                { props["series"] = (c["props"].cast<Map<String, Any?>>())["series"]; configure(); ctl.applyEngine() },
                { ctl.applyEngine() },
                { props["locale"] = "de-DE"; props["series"] = listOf(mapOf("label" to "Sales", "data" to listOf(1200.0, 2400.0, 1800.0, 3600.0, 3000.0, 4200.0))); configure(); ctl.applyEngine() },
                { themeDensity = ChartProps(props).num("density") ?: inherited; props["density"] = -3.0 })
            else -> emptyList()
        }
    }

    val diffs = mutableListOf<String>()
    fun d(msg: String) { if (diffs.size < 40) diffs.add(msg) }

    fun run(): Boolean {
        if (name.endsWith("-keys-zoomed")) ctl.setZoom(2.0, 4.0)
        if (name.endsWith("-keys-zoomed")) events.clear()
        val st = steps()
        if (st.size != phases.size) { d("steps ${st.size} != phases ${phases.size}"); return false }
        for ((i, p) in phases.withIndex()) {
            phaseIdx = i
            clock = num(p["t"]) + 1000.0
            val before = w to h
            sizeFrom(p)
            if (before != (w to h)) ctl.resize()
            st[i]()
            clock += 300.0
            ctl.tick(clock); ctl.tick(clock + 400)
            compare(i, p)
        }
        compareEvents()
        return diffs.isEmpty()
    }

    fun compare(i: Int, p: Map<String, Any?>) {
        val label = "${p["label"]}#$i"
        val samples: List<Map<String, Any?>> = p["samples"].cast()
        val sm = samples.lastOrNull() ?: return
        if ((sm["live"] ?: "") != ctl.announcement) d("$label live web '${sm["live"]}' native '${ctl.announcement}'")
        val hi = sm["hoverIndex"] as String?
        if (hi != ctl.hoverIndexAttr?.toString()) d("$label hoverIndex web $hi native ${ctl.hoverIndexAttr}")
        val tip = sm["tooltip"] as Map<String, Any?>?
        val hv = ctl.hover
        val m = hv?.model
        val text = m?.let { if (it.customText != null) it.customText else if (it.rows.isEmpty()) null else (listOf(it.header) + it.rows.flatMap { r -> listOf(r.label, r.value) }).joinToString("\n") }
        if ((tip?.get("text") as String?) != text) d("$label tooltip web ${tip?.get("text")?.toString()?.replace("\n", "|")} native ${text?.replace("\n", "|")}")
        if (tip != null && text != null) {
            val r: Map<String, Any?> = tip["rect"].cast()
            val o = ctl.tooltipOrigin(num(r["width"]), num(r["height"]), true)!!
            if (abs(ox + o.first - num(r["x"])) > 0.02 || abs(oy + o.second - num(r["y"])) > 0.02) d("$label tooltip at web ${r["x"]},${r["y"]} native ${ox + o.first},${oy + o.second}")
        }
        val nodes = (sm["hoverNodes"] as List<Map<String, Any?>>?) ?: emptyList()
        if (m != null) {
            val mine = mutableListOf<Pair<String, List<Double>>>()
            m.line?.let { mine.add("line" to listOf(ox + it.x, oy + it.y, it.w, it.h)) }
            m.markers.forEach { mine.add((if (it.dimmed) "0.4" else "1") to listOf(ox + it.x, oy + it.y)) }
            if (nodes.size != mine.size) d("$label hover nodes web ${nodes.size} native ${mine.size}")
            for ((k, n) in nodes.withIndex()) {
                val mm = mine.getOrNull(k) ?: break
                val r: Map<String, Any?> = n["rect"].cast()
                if (mm.first == "line") {
                    val e = listOf(num(r["x"]), num(r["y"]), num(r["width"]), num(r["height"]))
                    if (e.zip(mm.second).any { abs(it.first - it.second) > 0.02 }) d("$label crosshair web $e native ${mm.second}")
                } else {
                    val cx = num(r["x"]) + num(r["width"]) / 2; val cy = num(r["y"]) + num(r["height"]) / 2
                    if (abs(cx - mm.second[0]) > 0.03 || abs(cy - mm.second[1]) > 0.03) d("$label marker[$k] web $cx,$cy native ${mm.second}")
                    if (n["opacity"] != mm.first) d("$label marker[$k] opacity web ${n["opacity"]} native ${mm.first}")
                }
            }
        } else if (nodes.isNotEmpty()) d("$label hover nodes web ${nodes.size} native 0")
        val web = p["scene"] as Map<String, Any?>?
        if (web != null) {
            diffsOut = mutableListOf(); cmp(web, chartSceneJson(ctl.scene!!), "scene")
            diffsOut.take(6).forEach { d("$label $it") }
        }
    }

    fun norm(v: Any?): Any? = when (v) {
        is Map<*, *> -> v.entries.filter { it.key != "nativeEvent" && it.value != null || it.key == "value" || it.key == "axisValue" }.associate { it.key.toString() to norm(it.value) }.toSortedMap()
        is List<*> -> v.map { norm(it) }
        is Number -> v.toDouble()
        else -> v
    }

    fun compareEvents() {
        val webEv: List<Map<String, Any?>> = c["events"].cast()
        val ph = phases.map { num(it["t"]) }
        val web = webEv.map { e -> val t = num(e["t"]); (ph.indexOfLast { it <= t }.coerceAtLeast(0)) to (e["name"] as String to norm(e["detail"])) }
        val mine = events.map { it.first to (it.second.name to norm(it.second.detail)) }
        if (web.map { it.second } != mine.map { it.second }) {
            d("events web ${web.size} native ${mine.size}")
            for (k in 0 until maxOf(web.size, mine.size)) {
                val a = web.getOrNull(k); val b = mine.getOrNull(k)
                if (a?.second != b?.second) d("  ev[$k] web ${a?.first}:${a?.second.toString().take(220)}\n            native ${b?.first}:${b?.second.toString().take(220)}")
            }
        } else if (web.map { it.first } != mine.map { it.first }) d("event phases web ${web.map { it.first }} native ${mine.map { it.first }}")
    }
}

object Interact { @JvmStatic fun main(args: Array<String>) {
    val dir = args[0]; val kinds = args.drop(1).ifEmpty { listOf("line", "area") }
    var total = 0; var ok = 0
    for (kind in kinds) for (subset in listOf("hover", "hover-reduced-motion", "keys", "pointer")) {
        val f = File("$dir/md-$kind-chart/$subset.json"); if (!f.exists()) { println("missing $f"); continue }
        val root: Map<String, Any?> = chartParseJson(f.readText()).cast()
        val cases: List<Map<String, Any?>> = root["cases"].cast()
        var pass = 0
        for (c in cases) {
            total++
            val r = Replayer(kind, c, subset.endsWith("reduced-motion"))
            val good = try { r.run() } catch (e: Exception) { r.d("EXC $e ${e.stackTrace.take(4).joinToString()}"); false }
            if (good) { pass++; ok++ } else { println("FAIL ${r.name} ($subset)"); r.diffs.take(14).forEach { println("   $it") } }
        }
        println("md-$kind-chart $subset: $pass/${cases.size}")
    }
    println("TOTAL $ok/$total")
} }
