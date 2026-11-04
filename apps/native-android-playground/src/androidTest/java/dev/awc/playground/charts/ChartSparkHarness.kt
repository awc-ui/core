// GENERATED from the chart JVM harness (mk-atest.py) — do not edit here.
package dev.awc.playground.charts

import dev.awc.nativeui.charts.*
import java.io.File
import kotlin.math.abs

// Replays the md-sparkline states oracle through ChartSparkInteraction: events, the hover card's text and
// position, the aria-label summary and the engine scene after re-feed / variant / colour / theme steps.

class SparkReplayer(val c: Map<String, Any?>) {
    val name = c["name"] as String
    val phases: List<Map<String, Any?>> = c["phases"].cast()
    val rtl = c["dir"] == "rtl"
    var dark = c["theme"] == "dark"
    val ctl = ChartSparkInteraction()
    var clock = 0.0
    val events = mutableListOf<Pair<Int, ChartEvent>>()
    var phaseIdx = 0
    val props: MutableMap<String, Any?>
    val inline: Map<String, String>
    var w = 0.0; var h = 0.0; var ox = 0.0; var oy = 0.0
    val fm = ChartFormatters()
    val diffs = mutableListOf<String>()
    fun d(m: String) { if (diffs.size < 40) diffs.add(m) }

    init {
        val (p, i, _) = parse(c["html"] as String, "md-sparkline")
        c["props"].cast<Map<String, Any?>?>()?.forEach { (k, v) -> p[k] = v }
        props = p; inline = i
        if (name == "spark-hover-labels-formatter") fm.valueFormatter = { v -> if (v == null) "—" else "€" + jsNumberString(v) }
        ctl.now = { clock }; ctl.rtl = rtl
        ctl.onEvent = { events.add(phaseIdx to it) }
        ctl.rebuild = { plot ->
            val toks = tokens(dark); toks.putAll(inline)
            val pr = ChartProps(props)
            val theme = chartReadTheme(toks, 0.0)
            plot.scene = chartRenderSparkScene(ChartSparkInput(pr, toks, fm), theme, w, h, rtl, ApproxMeasurer())
            if (plot is ChartCartesianInteraction) plot.yFormatter = { v -> fm.valueFormatter?.invoke(v) ?: ChartIntl.number(v, "") }
            if (plot is ChartBarInteraction) plot.valueFormatter = { v -> fm.valueFormatter?.invoke(v) ?: ChartIntl.number(v, "") }
        }
        sizeFrom(phases[0])
        apply()
    }

    fun apply() {
        val pr = ChartProps(props)
        ctl.data = (props["data"] as? List<*>)?.toList() ?: emptyList()
        ctl.showTooltip = props["showTooltip"].let { it != "false" && it != false }
        ctl.applyEngine(pr.str("variant", "line"))
    }

    fun sizeFrom(p: Map<String, Any?>) {
        val cv = p["overlay"].cast<List<Map<String, Any?>>>().first { it["tag"] == "canvas" }
        val r: Map<String, Any?> = cv["rect"].cast()
        w = num(r["width"]); h = num(r["height"]); ox = num(r["x"]); oy = num(r["y"])
    }

    // pointer targets from the first settled scene (sparkline-states.html `geometry`)
    val xs: List<Double> = ctl.plot.scene!!.let { s -> if (s.xPositions.isNotEmpty()) s.xPositions else s.bars.map { it.x + it.w / 2 } }
    val midY = ctl.plot.scene!!.let { it.plot.y + it.plot.height / 2 }
    fun q(x: Double, y: Double) = ((ox + x).toFloat().toDouble() - ox) to ((oy + y).toFloat().toDouble() - oy)
    fun hover(i: Int) { val p = q(xs[i], midY); ctl.plot.pointerMove(p.first, p.second) }
    fun click(i: Int) { val p = q(xs[i], midY); ctl.plot.pointerMove(p.first, p.second); ctl.plot.pointerDown(p.first, p.second, 0); ctl.plot.pointerUp(p.first, p.second, true) }
    fun set(k: String, v: Any?) { props[k] = v; apply() }
    val DATA: List<Any?> = c["props"].cast<Map<String, Any?>>()["data"].cast()

    fun steps(): List<() -> Unit> = phases.map { p ->
        val l = p["label"] as String
        when {
            l == "settled" || l == "tab-in" || l == "Enter" || l == "ArrowRight" -> ({})
            l == "leave" -> ({ ctl.plot.pointerLeave() })
            l.startsWith("hover-") -> ({ hover(l.removePrefix("hover-").toInt()) })
            l.startsWith("click-") -> ({ click(l.removePrefix("click-").toInt()) })
            l == "values" -> ({ set("data", DATA.map { 40 - num(it) }) })
            l == "longer" -> ({ set("data", DATA + listOf(36.0, 38.0, 41.0)) })
            l == "empty" -> ({ set("data", emptyList<Any?>()) })
            l == "back" -> ({ set("data", DATA) })
            l == "to-bar" -> ({ set("variant", "bar") })
            l == "to-area" -> ({ set("variant", "area") })
            l == "color" -> ({ set("color", "error") })
            l == "ref" -> ({ set("referenceAreas", listOf(mapOf("from" to 2.0, "to" to 5.0, "label" to "Promo"))) })
            l == "to-dark" -> ({ dark = true; apply() })
            l == "to-light" -> ({ dark = false; apply() })
            else -> ({ d("unknown step $l") })
        }
    }

    fun run(): Boolean {
        val st = steps()
        for ((i, p) in phases.withIndex()) {
            phaseIdx = i
            clock = num(p["t"]) + 5000.0
            val before = w to h
            sizeFrom(p)
            if (before != (w to h)) ctl.plot.resize()
            st[i]()
            compare(i, p)
        }
        val web = c["events"].cast<List<Map<String, Any?>>>().filter { it["name"] != "mdReady" }.map { it["name"] to (it["detail"] as Map<*, *>).mapValues { (_, v) -> (v as? Number)?.toDouble() ?: v } }
        val mine = events.map { it.second.name to it.second.detail.mapValues { (_, v) -> (v as? Number)?.toDouble() ?: v } }
        if (web != mine) d("events web $web native $mine")
        return diffs.isEmpty()
    }

    fun compare(i: Int, p: Map<String, Any?>) {
        val label = "${p["label"]}#$i"
        val sm = p["samples"].cast<List<Map<String, Any?>>>().lastOrNull() ?: return
        val hv = ctl.plot.hover
        val m = hv?.model
        val text = m?.let { if (it.customText != null) it.customText else if (it.rows.isEmpty()) null else it.header + it.rows.joinToString("") { r -> r.label + r.value } }
        if (sm["tip"] as String? != text) d("$label tip web ${sm["tip"]} native $text")
        val r = sm["tipRect"] as Map<String, Any?>?
        if (r != null && text != null) {
            val th = num(r["height"])
            val o = ctl.plot.tooltipOrigin(num(r["width"]), th, oy - kotlin.math.round(th) - 6 >= 0)!!
            if (abs(ox + o.first - num(r["x"])) > 1.0 / 64 || abs(oy + o.second - num(r["y"])) > 1.0 / 64) d("$label tip at web ${r["x"]},${r["y"]} native ${ox + o.first},${oy + o.second}")
        }
        val summary = chartSparkSummary(ChartProps(props), fm)
        if (sm["label"] != summary) d("$label aria-label web '${sm["label"]}' native '$summary'")
        val web = (p["engine"] as Map<String, Any?>?)?.get("scene") as Map<String, Any?>?
        if (web != null) { diffsOut = mutableListOf(); cmp(web, chartSceneJson(ctl.plot.scene!!), "scene"); diffsOut.take(6).forEach { d("$label $it") } }
    }
}

object SparkInteract { @JvmStatic fun main(args: Array<String>) {
    val root: Map<String, Any?> = chartParseJson(File(args[0]).readText()).cast()
    var ok = 0; var n = 0
    for (c in root["runs"].cast<List<Map<String, Any?>>>()) {
        n++
        val r = try { SparkReplayer(c) } catch (e: Exception) { println("FAIL ${c["name"]} init $e ${e.stackTrace.take(3).joinToString()}"); continue }
        val good = try { r.run() } catch (e: Exception) { r.d("EXC $e ${e.stackTrace.take(4).joinToString()}"); false }
        if (good) ok++ else { println("FAIL ${r.name}"); r.diffs.take(12).forEach { println("   $it") } }
    }
    println("md-sparkline states: $ok/$n")
} }
