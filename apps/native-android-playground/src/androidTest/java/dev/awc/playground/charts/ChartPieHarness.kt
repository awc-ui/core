// GENERATED from the chart JVM harness (mk-atest.py) — do not edit here.
package dev.awc.playground.charts

import dev.awc.nativeui.charts.*
import java.io.File
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.sin

// Replays the md-pie-chart states oracle through ChartPieInteraction: events, live region, tooltip text and
// position, and the engine scene after legend / re-feed / drill / loading / theme steps.

class PieReplayer(val c: Map<String, Any?>) {
    val name = c["name"] as String
    val phases: List<Map<String, Any?>> = c["phases"].cast()
    val rtl = c["dir"] == "rtl"
    var dark = c["theme"] == "dark"
    val ctl = ChartPieInteraction()
    var clock = 0.0
    val events = mutableListOf<Pair<Int, ChartEvent>>()
    var phaseIdx = 0
    val props: MutableMap<String, Any?>
    val inline: Map<String, String>
    val inherited: Double
    var w = 0.0; var h = 0.0; var ox = 0.0; var oy = 0.0
    val fm = ChartFormatters()
    val diffs = mutableListOf<String>()
    fun d(m: String) { if (diffs.size < 40) diffs.add(m) }

    init {
        val (p, i, inh) = parse(c["html"] as String, "md-pie-chart")
        c["props"].cast<Map<String, Any?>?>()?.forEach { (k, v) -> p[k] = v }
        props = p; inline = i; inherited = inh
        if (name == "pie-keyboard-templates") fm.valueFormatter = { v -> "${jsNumberString(v!!)} vizite" }
        if (name == "pie-hover-tooltip-renderer") ctl.renderer = { ctx -> ChartTooltipContent.Text("${ctx.axisLabel}: ${String.format(java.util.Locale.US, "%.2f", ctx.series.first { it.focused }.percent)}% of traffic") }
        ctl.now = { clock }
        ctl.rtl = rtl
        ctl.onEvent = { events.add(phaseIdx to it) }
        sizeFrom(phases[0])
        configure()
        ctl.buildSpec = {
            val toks = tokens(dark); toks.putAll(inline)
            val pr = ChartProps(props)
            val density = pr.num("density")?.takeIf { it in listOf(-1.0, -2.0, -3.0, -4.0) } ?: inherited
            chartBuildPieSpec(ChartCartesianInput("md-pie-chart", pr, toks, density, fm, null, ctl.legendHidden), chartReadTheme(toks, density), rtl)
        }
        ctl.layout = { spec ->
            val toks = tokens(dark); toks.putAll(inline)
            val pr = ChartProps(props)
            val density = pr.num("density")?.takeIf { it in listOf(-1.0, -2.0, -3.0, -4.0) } ?: inherited
            chartComputePieLayout(spec, chartReadTheme(toks, density).engine, w, h)
        }
        ctl.applyEngine()
    }

    fun sizeFrom(p: Map<String, Any?>) {
        val cv = p["overlay"].cast<List<Map<String, Any?>>>().first { it["tag"] == "canvas" }
        val r: Map<String, Any?> = cv["rect"].cast()
        w = num(r["width"]); h = num(r["height"]); ox = num(r["x"]); oy = num(r["y"])
    }

    fun configure() {
        val pr = ChartProps(props)
        ctl.data = (props["data"] as? List<*>)?.map { it.cast<Map<String, Any?>>() } ?: emptyList()
        ctl.locale = pr.str("locale", "")
        ctl.labelPoint = pr.str("labelPoint", "%label%: %value% (%percent%)")
        ctl.valueFormatter = fm.valueFormatter?.let { f -> { v: Double -> f(v) } }
    }

    // hover targets are taken once, from the settled first scene (pie-states.html `geometry`)
    val probe: Map<Int, Pair<Double, Double>> = ctl.scene!!.slices.reversed().associate { sl -> val a = (sl.startAngle + sl.endAngle) / 2; val r = (sl.innerR + sl.outerR) / 2; sl.dataIndex to (sl.cx + cos(a) * r to sl.cy + sin(a) * r) }
    fun q(p: Pair<Double, Double>) = ((ox + p.first).toFloat().toDouble() - ox) to ((oy + p.second).toFloat().toDouble() - oy)
    fun hover(i: Int) { val p = q(probe.getValue(i)); ctl.pointerMove(p.first, p.second) }
    fun setData(v: Any?) { props["data"] = v; configure(); ctl.applyEngine() }
    val DATA: List<Map<String, Any?>> = c["props"].cast<Map<String, Any?>>()["data"].cast()

    fun steps(): List<() -> Unit> {
        val leave = { ctl.pointerLeave() }
        return when {
            name.contains("-entrance-") || name == "pie-nested-entrance" -> listOf({})
            name == "pie-replay" -> listOf({ ctl.replay() })
            name.startsWith("pie-hover-") && name != "pie-hover-rtl-dark" && name != "pie-hover-locale-de" && name != "pie-hover-tooltip-renderer" && name != "pie-hover-nested" -> listOf({ hover(0) }, { hover(2) }, leave)
            name == "donut-hover-slice" -> listOf({ hover(0) }, { hover(3) }, leave)
            name == "pie-hover-rtl-dark" -> listOf({ hover(1) }, leave)
            name == "pie-hover-locale-de" || name == "pie-hover-tooltip-renderer" -> listOf({ hover(0) }, leave)
            name == "pie-hover-nested" -> listOf({ hover(0) }, { hover(4) }, leave)
            name == "pie-click" -> listOf({ hover(1) }, { val p = q(probe.getValue(1)); ctl.pointerDown(p.first, p.second) }, { val p = q(probe.getValue(1)); ctl.pointerUp(p.first, p.second) },
                { setData(DATA.mapIndexed { i, m -> if (i == 1) m + ("selected" to true) else m }) }, leave)
            name.startsWith("pie-keyboard-") || name == "pie-legend-keyboard" -> {
                val labels = phases.map { it["label"] as String }
                var legendFocus = -1
                labels.map { l ->
                    when (l) {
                        "tab-in" -> ({})
                        "Space", " " -> ({ if (legendFocus >= 0) ctl.legendToggle(legendFocus) else ctl.keyDown(" ") })
                        "Enter" -> ({ if (legendFocus >= 0) ctl.legendToggle(legendFocus) else ctl.keyDown("Enter") })
                        "Tab" -> ({ if (name == "pie-legend-keyboard") { if (legendFocus < 0) ctl.blur(); legendFocus++ } else ctl.blur() })
                        "Tab+Shift" -> ({ legendFocus-- })
                        "shrink" -> ({ setData(DATA.take(2)) })
                        "hide-current" -> ({ setData(DATA.take(2).mapIndexed { i, m -> if (i == 0) m + ("hidden" to true) else m }) })
                        "empty" -> ({ setData(emptyList<Any?>()) })
                        else -> ({ ctl.keyDown(l) })
                    }
                }
            }
            name == "pie-legend-pointer" -> listOf({ ctl.legendToggle(1) }, { ctl.legendToggle(3) }, { setData(DATA.map { it + ("value" to num(it["value"]) + 1) }) }, { ctl.legendToggle(1) }, leave)
            name == "pie-legend-rtl" -> listOf({ ctl.legendToggle(0) }, leave)
            name == "pie-refeed" -> listOf({ setData(DATA.mapIndexed { i, m -> m + ("value" to listOf(10.0, 30.0, 25.0, 20.0, 15.0)[i]) }) }, { setData(DATA.take(3)) })
            name == "pie-drill" -> {
                val nested = listOf(
                    mapOf("id" to "hw", "label" to "Hardware", "value" to 40.0, "children" to listOf(mapOf("label" to "Phones", "value" to 10.0), mapOf("label" to "Laptops", "value" to 22.0), mapOf("label" to "Tablets", "value" to 8.0))),
                    mapOf("id" to "sv", "label" to "Services", "value" to 35.0), mapOf("id" to "sw", "label" to "Software", "value" to 25.0))
                listOf({ ctl.drill(0, "down"); setData(nested[0]["children"]) }, { ctl.drill(0, "up"); setData(nested.map { it - "children" }) })
            }
            name == "pie-loading-to-loaded" -> listOf({ setData(listOf(
                mapOf("id" to "search", "label" to "Search", "value" to 42.0), mapOf("id" to "direct", "label" to "Direct", "value" to 26.0), mapOf("id" to "social", "label" to "Social", "value" to 18.0),
                mapOf("id" to "email", "label" to "Email", "value" to 9.0), mapOf("id" to "referral", "label" to "Referral", "value" to 5.0))); props.remove("loading"); ctl.loadingChanged() })
            name == "pie-theme-flip" -> listOf({ dark = true; ctl.applyEngine() }, { dark = false; ctl.applyEngine() })
            else -> emptyList()
        }
    }

    fun run(): Boolean {
        val st = steps()
        if (st.size != phases.size) { d("steps ${st.size} != phases ${phases.size}"); return false }
        for ((i, p) in phases.withIndex()) {
            phaseIdx = i
            clock = num(p["t"]) + 5000.0
            val before = w to h
            sizeFrom(p)
            if (before != (w to h)) ctl.resize()
            st[i]()
            for (k in 1..60) { clock += 16.0; ctl.tick(clock) }
            ctl.drillFrame(clock + 2000)
            compare(i, p)
        }
        compareEvents()
        return diffs.isEmpty()
    }

    fun compare(i: Int, p: Map<String, Any?>) {
        val label = "${p["label"]}#$i"
        val sm = p["samples"].cast<List<Map<String, Any?>>>().lastOrNull() ?: return
        if ((sm["live"] ?: "") != ctl.announcement) d("$label live web '${sm["live"]}' native '${ctl.announcement}'")
        val t = ctl.tooltip
        val text = t?.let { it.customText ?: (it.label + it.value) }
        if (sm["tip"] as String? != text) d("$label tip web ${sm["tip"]} native $text")
        val r = sm["tipRect"] as Map<String, Any?>?
        if (r != null && t != null) {
            val o = ctl.tooltipOrigin(num(r["width"]), num(r["height"]))!!
            if (abs(ox + o.first - num(r["x"])) > 1.0 / 64 || abs(oy + o.second - num(r["y"])) > 1.0 / 64) d("$label tip at web ${r["x"]},${r["y"]} native ${ox + o.first},${oy + o.second}")
        }
        val eng = p["engine"] as Map<String, Any?>?
        val web = eng?.get("scene") as Map<String, Any?>?
        if (web != null) {
            diffsOut = mutableListOf(); cmp(web, chartSceneJson(ctl.scene!!), "scene")
            diffsOut.take(6).forEach { d("$label $it") }
        }
    }

    fun norm(v: Any?): Any? = when (v) {
        is Map<*, *> -> v.entries.filter { it.key != "nativeEvent" }.associate { it.key.toString() to norm(it.value) }.toSortedMap()
        is List<*> -> v.map { norm(it) }
        is Number -> v.toDouble()
        else -> v
    }

    fun compareEvents() {
        val ph = phases.map { num(it["t"]) }
        val web = c["events"].cast<List<Map<String, Any?>>>().filter { it["name"] != "mdReady" }.map { e -> (ph.indexOfLast { it <= num(e["t"]) }.coerceAtLeast(0)) to (e["name"] as String to norm(e["detail"])) }
        val mine = events.map { it.first to (it.second.name to norm(it.second.detail)) }
        if (web.map { it.second } != mine.map { it.second }) {
            d("events web ${web.size} native ${mine.size}")
            for (k in 0 until maxOf(web.size, mine.size)) { val a = web.getOrNull(k); val b = mine.getOrNull(k); if (a?.second != b?.second) d("  ev[$k] web ${a?.second.toString().take(200)} | native ${b?.second.toString().take(200)}") }
        } else if (web.map { it.first } != mine.map { it.first }) d("event phases web ${web.map { it.first }} native ${mine.map { it.first }}")
    }
}

object PieInteract { @JvmStatic fun main(args: Array<String>) {
    val root: Map<String, Any?> = chartParseJson(File(args[0]).readText()).cast()
    var ok = 0; var n = 0
    for (c in root["runs"].cast<List<Map<String, Any?>>>()) {
        n++
        val r = try { PieReplayer(c) } catch (e: Exception) { println("FAIL ${c["name"]} init $e ${e.stackTrace.take(3).joinToString()}"); continue }
        val good = try { r.run() } catch (e: Exception) { r.d("EXC $e ${e.stackTrace.take(4).joinToString()}"); false }
        if (good) ok++ else { println("FAIL ${r.name}"); r.diffs.take(12).forEach { println("   $it") } }
    }
    println("md-pie-chart states: $ok/$n")
} }
