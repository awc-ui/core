// GENERATED from the chart JVM harness (mk-atest.py) — do not edit here.
package dev.awc.playground.charts

import dev.awc.nativeui.charts.*
import java.io.File
import kotlin.math.abs

fun tokens(dark: Boolean): MutableMap<String, String> {
    val css = ChartTestEnv.text("md3.css")
    val out = LinkedHashMap<String, String>()
    fun block(sel: String) { val i = css.indexOf("$sel{").let { if (it < 0) css.indexOf("$sel {") else it }; if (i < 0) return; val body = css.substring(css.indexOf('{', i) + 1, css.indexOf('}', i))
        Regex("""(--[\w-]+)\s*:\s*([^;]+)""").findAll(body).forEach { out[it.groupValues[1]] = it.groupValues[2].trim() } }
    block(":root"); if (dark) block("[data-theme=dark]")
    return out
}

fun parse(html: String, tag: String): Triple<MutableMap<String, Any?>, Map<String, String>, Double> {
    val props = LinkedHashMap<String, Any?>(); val inline = LinkedHashMap<String, String>(); var inherited = 0.0
    Regex("""data-density="([^"]*)"""").find(html)?.let { inherited = it.groupValues[1].toDoubleOrNull() ?: 0.0 }
    val open = html.indexOf("<$tag"); if (open < 0) return Triple(props, inline, inherited)
    val attrs = html.substring(open + "<$tag".length, html.indexOf('>', open))
    Regex("""([a-zA-Z][a-zA-Z0-9-]*)(?:="([^"]*)")?""").findAll(attrs).forEach { m ->
        val name = m.groupValues[1]; val value = if (m.groups[2] == null) null else m.groupValues[2]
        if (name == "style") { value?.split(";")?.forEach { d -> val kv = d.split(":", limit = 2).map { it.trim() }; if (kv.size == 2 && kv[0].startsWith("--")) inline[kv[0]] = kv[1] }; return@forEach }
        val camel = name.split("-").mapIndexed { i, s -> if (i == 0) s else s.replaceFirstChar { it.uppercase() } }.joinToString("")
        if (camel !in props) props[camel] = value ?: true  // HTML: the first duplicate attribute wins
    }
    return Triple(props, inline, inherited)
}

var diffsOut = mutableListOf<String>()
fun cmp(a: Any?, b: Any?, path: String) {
    if (diffsOut.size > 200) return
    when {
        a is Map<*, *> && b is Map<*, *> -> (a.keys + b.keys).map { it.toString() }.toSortedSet().forEach { k ->
            if (!a.containsKey(k)) diffsOut.add("$path.$k: web missing, native ${b[k].toString().take(80)}")
            else if (!b.containsKey(k)) diffsOut.add("$path.$k: native missing, web ${a[k].toString().take(80)}")
            else cmp(a[k], b[k], "$path.$k") }
        a is List<*> && b is List<*> -> { if (a.size != b.size) diffsOut.add("$path: length web ${a.size} native ${b.size}"); for (i in 0 until minOf(a.size, b.size)) cmp(a[i], b[i], "$path[$i]") }
        a is Double && b is Number -> if (abs(a - b.toDouble()) > 0.0101) diffsOut.add("$path: web $a native $b")
        a is String && b is String -> if (a != b) diffsOut.add("$path: web \"$a\" native \"$b\"")
        a is Boolean && b is Boolean -> if (a != b) diffsOut.add("$path: web $a native $b")
        a == null && b == null -> {}
        else -> diffsOut.add("$path: web ${a.toString().take(80)} native ${b.toString().take(80)}")
    }
}

fun sceneMain(args: Array<String>) {
    val dir = args[0]; val kinds = args.drop(1).ifEmpty { listOf("line", "area") }
    var total = 0; var ok = 0
    for (kind in kinds) for (subset in if (kind == "pie" || kind == "sparkline") listOf("paint") else listOf("paint-core", "paint-extra", "paint-dark-extra", "paint-forced-colors")) {
        val tag = if (kind == "sparkline") "md-sparkline" else "md-$kind-chart"
        val f = File("$dir/$tag/$subset.json"); if (!f.exists()) { println("missing $f"); continue }
        @Suppress("UNCHECKED_CAST") val root = chartParseJson(f.readText()) as Map<String, Any?>
        @Suppress("UNCHECKED_CAST") val cases = root["cases"] as List<Map<String, Any?>>
        var pass = 0; var n = 0
        for (c in cases) {
            @Suppress("UNCHECKED_CAST") val web = (c["scene"] ?: (c["engine"] as? Map<String, Any?>)?.get("scene")) as? Map<String, Any?> ?: continue
            n++; total++
            val name = c["name"] as String
            val (props, inline, inherited) = parse(c["html"] as String, tag)
            @Suppress("UNCHECKED_CAST") (c["props"] as? Map<String, Any?>)?.forEach { (k, v) -> props[k] = v }
            val toks = tokens(c["theme"] == "dark"); toks.putAll(inline)
            val pr = ChartProps(props)
            val density = pr.num("density")?.takeIf { it in listOf(-1.0, -2.0, -3.0, -4.0) } ?: inherited
            val fm = ChartFormatters()
            when {
                name == "pie-value-formatter" -> fm.valueFormatter = { v -> "$" + String.format(java.util.Locale.US, "%.2f", v ?: 0.0) }
                name == "spark-labels-formatter" -> fm.valueFormatter = { v -> if (v == null) "—" else "€" + jsNumberString(v) }
                name.endsWith("-formatter") -> fm.valueFormatter = { v -> if (v == null) "–" else "$" + String.format(java.util.Locale.US, "%.1f", v / 1000) + "k" }
            }
            // Cases whose data is assigned in `prepare` (after mount) use the page's default data set.
            if (name.endsWith("ancestor-density-3") && (kind == "pie" || kind == "sparkline")) props[if (kind == "pie") "data" else "data"] = (cases[0]["props"] as Map<*, *>)["data"]
            val input = ChartCartesianInput(tag, pr, toks, density, fm, if (name.endsWith("zoom-both-window")) 1 to 4 else null)
            val theme = chartReadTheme(toks, density)
            val w = (web["width"] as Number).toDouble(); val h = (web["height"] as Number).toDouble()
            val rtl = c["dir"] == "rtl"
            val scene = when (kind) {
                "bar" -> chartRenderBarScene(chartBuildBarSpec(input, theme), theme.engine, w, h, rtl, ApproxMeasurer())
                "pie" -> chartComputePieLayout(chartBuildPieSpec(input, theme, rtl).also { it.highlightIndex = -1; it.highlightT = 0.0 }, theme.engine, w, h)
                "sparkline" -> chartRenderSparkScene(ChartSparkInput(pr, toks, fm), theme, w, h, rtl, ApproxMeasurer())
                else -> chartRenderScene(chartBuildCartesianSpec(input, theme), theme.engine, w, h, rtl, ApproxMeasurer())
            }
            diffsOut = mutableListOf(); cmp(web, chartSceneJson(scene), "scene")
            if (diffsOut.isEmpty()) { pass++; ok++ } else { println("FAIL $name: ${diffsOut.size}"); diffsOut.take(10).forEach { println("   $it") } }
        }
        println("md-$kind-chart $subset: $pass/$n")
    }
    println("TOTAL $ok/$total")
}
