package dev.awc.playground

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.LocalTextStyle
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performMouseInput
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.awc.nativeui.*
import dev.awc.nativeui.charts.ChartFormatters
import dev.awc.playground.CardWeb.objects
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import kotlin.math.abs

/**
 * md-line/area/bar/pie-chart and md-sparkline: the rendered Compose views against Chrome 153 (gate 5, r5 R5-02/R5-03/R5-06),
 * at 1 px per dp (DPR 1). Every published Mac paint case (assets ChartWebPaint/<tag>/<subset>.json + shots-<subset>/) is
 * rebuilt from the same markup, properties, slots, hooks and ::part rules through AWCComponent (production dispatch).
 * Checks: the host box and every flat pixel of the clip (CardWeb.compare); a chart embedded in page text compares its
 * host box region. Slotted light-DOM content is the page's (rendered here with its inline styles); the chart places it.
 */
private val pageRoboto = androidx.compose.ui.text.font.FontFamily(androidx.compose.ui.text.font.Font(dev.awc.nativeui.R.font.awc_roboto_regular, FontWeight.Normal), androidx.compose.ui.text.font.Font(dev.awc.nativeui.R.font.awc_roboto_medium, FontWeight.Medium))

class NativeChartPaintTest {
    @get:Rule val compose = createComposeRule()
    private var case by mutableStateOf<JSONObject?>(null)
    private var tag by mutableStateOf("")
    private var epoch by mutableIntStateOf(0)
    private var hostBox = floatArrayOf(0f, 0f, 0f, 0f)
    private val controller = AWCChartController()
    private var firstData: Any? = null
    private var checks = 0; private val failures = mutableListOf<String>(); private val report = JSONArray()
    private fun check(ok: Boolean, label: String) { checks++; if (!ok) failures += label }

    private fun kotlin(v: Any?): Any? = when (v) {
        is JSONArray -> List(v.length()) { kotlin(v.get(it)) }
        is JSONObject -> v.keys().asSequence().associateWith { kotlin(v.get(it)) }
        is Int -> v.toDouble(); is Long -> v.toDouble(); is Float -> v.toDouble()
        JSONObject.NULL -> null
        else -> v
    }
    private fun attrs(open: String): List<Pair<String, String?>> =
        Regex("([a-zA-Z_:][a-zA-Z0-9_.:-]*)(?:\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)'|([^\\s\"'>]+)))?").findAll(open).map { m ->
            m.groupValues[1] to (m.groups[2]?.value ?: m.groups[3]?.value ?: m.groups[4]?.value)?.replace("&quot;", "\"")?.replace("&amp;", "&") }.toList()

    /** A parsed authored element (the page's light DOM). */
    private data class El(val tag: String, val attrs: Map<String, String>, val kids: List<El>, val text: String? = null)
    private fun parse(html: String): List<El> {
        var i = 0
        fun kids(): List<El> {
            val out = mutableListOf<El>()
            while (i < html.length) {
                if (html[i] == '<') {
                    val end = html.indexOf('>', i).takeIf { it >= 0 } ?: html.length
                    if (html.getOrNull(i + 1) == '/') { i = end + 1; return out }
                    var inner = html.substring(i + 1, end); i = end + 1
                    val self = inner.endsWith("/"); if (self) inner = inner.dropLast(1)
                    val name = inner.takeWhile { !it.isWhitespace() }.lowercase()
                    val a = attrs(inner.drop(name.length)).associate { it.first to (it.second ?: "") }
                    val void = name in setOf("br", "img", "input", "hr", "meta", "link")
                    out += El(name, a, if (self || void) emptyList() else kids())
                } else {
                    val start = i; while (i < html.length && html[i] != '<') i++
                    val t = html.substring(start, i).replace("&nbsp;", "\u00A0").replace("&amp;", "&")
                    if (t.isNotBlank()) out += El("#text", emptyMap(), emptyList(), t)
                }
            }
            return out
        }
        return kids()
    }
    private fun find(nodes: List<El>, t: String): El? { for (n in nodes) { if (n.tag == t) return n; find(n.kids, t)?.let { return it } }; return null }

    private fun model(c: JSONObject, t: String): Triple<Map<String, Any?>, El?, Double?> {
        val html = c.getString("html")
        val p = HashMap<String, Any?>(); p["id"] = "chart"
        val open = Regex("<$t\\b([^>]*)>").find(html)?.groupValues?.get(1) ?: ""
        for ((name, value) in attrs(open)) {
            val camel = name.split('-').mapIndexed { k, w -> if (k == 0) w else w.replaceFirstChar { it.uppercase() } }.joinToString("")
            // Numeric attributes reach the renderer as numbers (the compiler types them from the manifest, e.g. density="-4").
            if (!p.containsKey(camel)) p[camel] = value?.let { v -> if (Regex("-?\\d+(\\.\\d+)?").matches(v)) v.toDouble() else v } ?: true
        }
        c.optJSONObject("props")?.let { o -> for (k in o.keys()) p[k] = kotlin(o.get(k)) }
        if (c.getString("name").endsWith("ancestor-density-3") && p["data"] == null && firstData != null && (t == "md-pie-chart" || t == "md-sparkline")) p["data"] = firstData
        val inherited = Regex("data-density=\"(-?[\\d.]+)\"").find(html)?.groupValues?.get(1)?.toDoubleOrNull()
        return Triple(p, find(parse(html), t), inherited)
    }
    private fun formatters(name: String): ChartFormatters? = when {
        name == "pie-value-formatter" -> ChartFormatters(valueFormatter = { v -> "$" + String.format(java.util.Locale.US, "%.2f", v ?: 0.0) })
        name == "spark-labels-formatter" -> ChartFormatters(valueFormatter = { v -> if (v == null) "—" else "€" + dev.awc.nativeui.charts.jsNumberString(v) })
        name.endsWith("-formatter") -> ChartFormatters(valueFormatter = { v -> if (v == null) "–" else "$" + String.format(java.util.Locale.US, "%.1f", v / 1000) + "k" })
        else -> null
    }
    private fun partRules(html: String): Map<AWCChartPart, AWCChartPartAppearance> {
        val css = Regex("<style>(.*?)</style>", RegexOption.DOT_MATCHES_ALL).find(html)?.groupValues?.get(1) ?: return emptyMap()
        val out = HashMap<AWCChartPart, AWCChartPartAppearance>()
        for (m in Regex("::part\\(([a-z-]+)\\)\\s*\\{([^}]*)\\}").findAll(css)) AWCChartPart.of(m.groupValues[1])?.let { p -> out[p] = (out[p] ?: AWCTablePartStyle()).merging(AWCTablePartStyle.css(m.groupValues[2])) }
        return out
    }
    private fun style(el: El): Map<String, String> = (el.attrs["style"] ?: "").split(';').mapNotNull { d -> d.split(':', limit = 2).takeIf { it.size == 2 }?.let { it[0].trim().lowercase() to it[1].trim() } }.toMap()
    private fun px(v: String?) = v?.trim()?.removeSuffix("px")?.toDoubleOrNull()
    private fun hex(v: String?): Color? = v?.trim()?.takeIf { it.startsWith("#") }?.let { s ->
        val h = s.drop(1).let { if (it.length <= 4) it.map { c -> "$c$c" }.joinToString("") else it }
        val n = h.toLong(16); if (h.length == 8) Color(((n shr 24) and 255).toInt(), ((n shr 16) and 255).toInt(), ((n shr 8) and 255).toInt(), (n and 255).toInt()) else Color(0xFF000000 or n) }

    /** The page's light-DOM slot content: text, spans / divs with the inline style subset the oracle pages use. */
    @Composable private fun Authored(el: El) {
        if (el.tag == "#text") { Text(el.text ?: ""); return }
        val st = style(el)
        if (el.attrs["class"]?.contains("material-symbols") == true || st["font-family"]?.contains("Material Symbols") == true) {
            AWCMaterialSymbol((el.kids.firstOrNull()?.text ?: "").trim(), size = (px(st["font-size"]) ?: 24.0).dp); return
        }
        var size = px(st["font-size"]); var weight: Double? = st["font-weight"]?.toDoubleOrNull()
        st["font"]?.split(' ')?.forEach { tk -> if (size == null && tk.toDoubleOrNull()?.let { it in 1.0..1000.0 } == true) weight = tk.toDouble() else if (tk.endsWith("px")) size = px(tk) }
        val base = LocalTextStyle.current
        val ts = base.copy(fontSize = size?.sp ?: base.fontSize, fontWeight = weight?.let { FontWeight(it.toInt()) } ?: base.fontWeight,
            textAlign = if (st["text-align"] == "center") TextAlign.Center else base.textAlign)
        val fill = st["position"] == "absolute" && st["inset"]?.trim() in setOf("0", "0px")
        val flex = st["display"]?.contains("flex") == true
        var m: Modifier = if (fill) Modifier.awcChartLayerFill() else Modifier
        hex(st["background"] ?: st["background-color"])?.let { m = m.background(it) }
        CompositionLocalProvider(LocalTextStyle provides ts, LocalContentColor provides (hex(st["color"]) ?: LocalContentColor.current)) {
            if (flex) Row(m, horizontalArrangement = if (st["justify-content"] == "center") Arrangement.Center else Arrangement.Start,
                verticalAlignment = if (st["align-items"] == "center") Alignment.CenterVertically else Alignment.Top) { el.kids.forEach { Authored(it) } }
            else if (el.kids.all { it.tag == "#text" || it.tag == "span" } && el.kids.size > 1) Row(m, verticalAlignment = Alignment.CenterVertically) { el.kids.forEach { Authored(it) } }
            else Column(m, horizontalAlignment = if (st["text-align"] == "center") Alignment.CenterHorizontally else Alignment.Start) { el.kids.forEach { Authored(it) } }
        }
    }

    private fun hostRect(c: JSONObject): JSONObject = c.optJSONObject("snap")?.optJSONObject("rect") ?: c.getJSONObject("tree").getJSONObject("rect")
    private fun content() { compose.setContent { CompositionLocalProvider(LocalDensity provides Density(1f, 1f)) {
        val c = case ?: return@CompositionLocalProvider
        val t = tag
        AWCTheme(c.optString("theme") == "dark") { Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.surface)) { key(epoch) {
            val r = hostRect(c); val (props, chartEl, inherited) = model(c, t)
            val parts = partRules(c.getString("html"))
            // The page's own inherited text: Roboto 16px black (oracle page body style).
            CompositionLocalProvider(LocalLayoutDirection provides if (c.optString("dir") == "rtl") LayoutDirection.Rtl else LayoutDirection.Ltr,
                LocalContentColor provides Color.Black, LocalTextStyle provides LocalTextStyle.current.copy(fontSize = 16.sp, fontFamily = pageRoboto)) {
                Box(Modifier.absoluteOffset(r.getDouble("x").dp, r.getDouble("y").dp).width(r.getDouble("width").dp)
                    .onGloballyPositioned { val o = it.positionInRoot(); hostBox = floatArrayOf(o.x, o.y, it.size.width.toFloat(), it.size.height.toFloat()) }) {
                    AWCDensityScope(inherited ?: 0.0) { AWCChartControllerScope(controller) { AWCChartPartAppearanceScope(parts) {
                        CompositionLocalProvider(LocalAWCChartFormatters provides (formatters(c.getString("name"))?.let { mapOf("chart" to it) } ?: emptyMap())) {
                            val slotted = chartEl?.kids?.filter { it.attrs["slot"] != null }.orEmpty()
                            if (slotted.isEmpty()) AWCComponent(t, props)
                            else AWCComponent(t, props) { name -> slotted.filter { it.attrs["slot"] == name }.forEach { Authored(it) } }
                        }
                    } } }
                }
            }
        } } }
    } } }

    private fun grid1x(map: androidx.compose.ui.graphics.PixelMap, x: Int, y: Int, w: Int, h: Int): CardWeb.Grid { val v = DoubleArray(w * h * 3)
        for (py in 0 until h) for (pxl in 0 until w) { val X = x + pxl; val Y = y + py
            if (X < map.width && Y < map.height) { val col = map[X, Y]; v[(py * w + pxl) * 3] = col.red * 255.0; v[(py * w + pxl) * 3 + 1] = col.green * 255.0; v[(py * w + pxl) * 3 + 2] = col.blue * 255.0 } else for (k in 0..2) v[(py * w + pxl) * 3 + k] = -999.0 }
        return CardWeb.Grid(x, y, w, h, v) }

    @Test fun chartsMatchChromePaint() {
        content()
        val assets = androidx.test.platform.app.InstrumentationRegistry.getInstrumentation().context.assets
        val only = androidx.test.platform.app.InstrumentationRegistry.getArguments().getString("chartPaintOnly")
        for (t in listOf("md-line-chart", "md-area-chart", "md-bar-chart", "md-pie-chart", "md-sparkline")) {
            for (file in (assets.list("ChartWebPaint/$t") ?: emptyArray()).filter { it.startsWith("paint") && it.endsWith(".json") && it != "paint-forced-colors.json" }.sorted()) {
                val subset = file.removeSuffix(".json")
                val oracle = CardWeb.document("ChartWebPaint/$t/$file")
                val cs = oracle.getJSONArray("cases").objects()
                firstData = cs.firstOrNull()?.optJSONObject("props")?.opt("data")?.let { kotlin(it) }
                val start = checks; val before = failures.size
                for (c in cs) if (only == null || c.getString("name").contains(only)) paint(c, t, "ChartWebPaint/$t/shots-$subset")
                AccordionEvidence.log("chart-paint-$t-$subset", JSONObject().put("checks", checks - start).put("failures", failures.size - before))
            }
        }
        tableLabelsChecks()
        AccordionEvidence.log("chart-paint", JSONObject().put("checks", checks).put("failures", failures.size).put("failureList", JSONArray(failures.take(300))).put("report", report))
        assertTrue("${failures.size} of $checks failed:\n" + failures.take(60).joinToString("\n"), failures.isEmpty())
    }

    /** R5-04: the TalkBack data table (the Web's screen-reader table) — headers from `tableLabels`, values as the Web prints them. */
    private fun tableLabelsChecks() {
        val start = checks; val before = failures.size
        fun t(kind: dev.awc.nativeui.charts.ChartKind, p: Map<String, Any?>) = chartDataTable(kind, dev.awc.nativeui.charts.ChartProps(p), ChartFormatters())
        val line = t(dev.awc.nativeui.charts.ChartKind.LINE, mapOf("label" to "Sales", "locale" to "en-US", "tableLabels" to mapOf("x" to "Monat", "series" to "Reihe"),
            "xAxis" to mapOf("data" to listOf("Jan", "Feb")), "series" to listOf(mapOf("label" to "Umsatz", "data" to listOf(1200, null)), mapOf("data" to listOf(3, 4)))))
        check(line?.name == "Sales" && line?.header == listOf("Monat", "Umsatz", "Reihe") && line?.rows == listOf(listOf("Jan", "1,200", "3"), listOf("Feb", "—", "4")),
            "tableLabels line: ${line?.header} ${line?.rows}")
        val index = t(dev.awc.nativeui.charts.ChartKind.AREA, mapOf("tableLabels" to "{\"index\":\"Nr.\"}", "series" to listOf(mapOf("data" to listOf(1, 2)))))
        check(index?.header == listOf("Nr.", "Series") && index?.rows?.map { it[0] } == listOf("1", "2"), "tableLabels index: ${index?.header} ${index?.rows}")
        val titled = t(dev.awc.nativeui.charts.ChartKind.AREA, mapOf("tableLabels" to mapOf("x" to "Monat"), "xAxis" to mapOf("label" to "Month", "data" to listOf("Jan")), "series" to listOf(mapOf("data" to listOf(1)))))
        check(titled?.header?.first() == "Month", "tableLabels: the x axis label wins (${titled?.header})")
        val bar = t(dev.awc.nativeui.charts.ChartKind.BAR, mapOf("tableLabels" to mapOf("index" to "Nr.", "series" to "Reihe"), "series" to listOf(mapOf("data" to listOf(1, 2)))))
        check(bar?.header == listOf("#", "Series"), "bar ignores tableLabels: ${bar?.header}")
        val pie = t(dev.awc.nativeui.charts.ChartKind.PIE, mapOf("label" to "Traffic", "locale" to "en-US", "tableLabels" to mapOf("category" to "Quelle", "value" to "Wert", "share" to "Anteil"),
            "data" to listOf(mapOf("label" to "Search", "value" to 42), mapOf("label" to "Direct", "value" to 26), mapOf("label" to "Email", "value" to 18.0))))
        check(pie?.header == listOf("Quelle", "Wert", "Anteil") && pie?.rows?.first() == listOf("Search", "42", "48.8%"), "tableLabels pie: ${pie?.header} ${pie?.rows?.firstOrNull()}")
        val plain = t(dev.awc.nativeui.charts.ChartKind.PIE, mapOf("data" to listOf(mapOf("label" to "A", "value" to 1))))
        check(plain?.header == listOf("Category", "Value", "Share") && plain?.rows?.first()?.last() == "100%", "tableLabels pie defaults: ${plain?.header} ${plain?.rows}")
        check(t(dev.awc.nativeui.charts.ChartKind.SPARKLINE, mapOf("data" to listOf(1, 2))) == null, "sparkline: no data table (an image, as on the Web)")
        AccordionEvidence.log("chart-data-table", JSONObject().put("checks", checks - start).put("failures", failures.size - before))
    }

    private fun paint(c: JSONObject, t: String, shots: String) {
        val name = c.getString("name"); val html = c.getString("html")
        compose.onRoot().performMouseInput { moveTo(Offset(1060f, 1180f)) }
        compose.runOnIdle { tag = t; case = c; epoch++ }
        compose.waitForIdle(); compose.mainClock.advanceTimeBy(400); compose.waitForIdle()
        if (name.endsWith("zoom-both-window")) { compose.runOnIdle { controller.setZoom(1.0, 4.0) }; compose.waitForIdle(); compose.mainClock.advanceTimeBy(300); compose.waitForIdle() }
        val r = hostRect(c)
        val embedded = !(html.startsWith("<$t") || html.startsWith("<style>") || html.startsWith("<div style=\"--md-sys-density-scale"))
        if (!embedded) check(abs(hostBox[0] - r.getDouble("x")) <= .6 && abs(hostBox[1] - r.getDouble("y")) <= .6 && abs(hostBox[2] - r.getDouble("width")) <= .6 && abs(hostBox[3] - r.getDouble("height")) <= .6,
            "$name host box (${hostBox.joinToString(",")}) vs $r")
        val clip = c.getJSONObject("clip")
        val area = if (embedded) JSONObject().put("x", r.getDouble("x").toInt()).put("y", r.getDouble("y").toInt()).put("width", r.getDouble("width").toInt()).put("height", r.getDouble("height").toInt()) else clip
        val web = CardWeb.webGrid("$shots/$name.png", clip).let { g -> if (!embedded) g else {
            val ax = area.getInt("x"); val ay = area.getInt("y"); val aw = area.getInt("width"); val ah = area.getInt("height"); val v = DoubleArray(aw * ah * 3)
            for (py in 0 until ah) for (pxl in 0 until aw) for (k in 0..2) v[(py * aw + pxl) * 3 + k] = g.v[((ay - g.y + py) * g.w + (ax - g.x + pxl)) * 3 + k]
            CardWeb.Grid(ax, ay, aw, ah, v) } }
        val nat = grid1x(compose.onRoot().captureToImage().toPixelMap(), area.getInt("x"), area.getInt("y"), area.getInt("width"), area.getInt("height"))
        val res = CardWeb.compare(web, nat)
        check(CardWeb.ok(res) || (embedded && res.getInt("compared") > 300 && res.getDouble("mean") <= 1.0), "$name flat pixels $res")
        if (!CardWeb.ok(res)) AccordionEvidence.png("chart-$name", compose.onRoot().captureToImage())
        report.put(res.put("case", name).put("host", JSONArray(hostBox.toList())))
    }
}
