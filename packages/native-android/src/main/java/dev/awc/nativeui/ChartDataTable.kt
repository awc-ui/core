package dev.awc.nativeui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.CollectionInfo
import androidx.compose.ui.semantics.CollectionItemInfo
import androidx.compose.ui.semantics.collectionInfo
import androidx.compose.ui.semantics.collectionItemInfo
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.text
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.unit.dp
import dev.awc.nativeui.charts.ChartAxisValue
import dev.awc.nativeui.charts.ChartFormatters
import dev.awc.nativeui.charts.ChartIntl
import dev.awc.nativeui.charts.ChartKind
import dev.awc.nativeui.charts.ChartProps
import dev.awc.nativeui.charts.ChartScaleType
import dev.awc.nativeui.charts.chartAxisValue
import dev.awc.nativeui.charts.chartDefaultValueFormatter
import dev.awc.nativeui.charts.chartJsString
import dev.awc.nativeui.charts.chartNormalizeSeriesX

/**
 * The chart's data for TalkBack — the Web's visually hidden screen-reader table (a11y.ts `buildDataTableHtml`, named by the
 * chart label): a header row (the x column — the x axis label, else `tableLabels.x`, or `tableLabels.index` without x data
 * (X / #); one column per series, an unlabelled one `tableLabels.series` (Series)) and one row per category with its row
 * header; md-pie-chart: Category / Value / Share (`tableLabels.category` / `value` / `share`). md-bar-chart declares no
 * `tableLabels` and keeps the defaults. Values print as the Web's: the consumer's value formatter, else the locale default
 * (`toLocaleString`), `—` for no value; shares with up to one decimal and `%`.
 */
class ChartDataTable(val name: String, val header: List<String>, val rows: List<List<String>>)

private const val CHART_TABLE_MAX = 200

private fun chartTableLabel(pr: ChartProps, key: String): String? =
    (awcMap(pr.obj("tableLabels"))[key] as? String)?.takeIf { it.isNotEmpty() }

private fun chartTableValue(d: AWCValue): Double? = when {
    d is Number -> d.toDouble().takeIf { it.isFinite() }
    d is Map<*, *> || (d != null && d.javaClass.name == "org.json.JSONObject") -> awcMap(d).let { (it["y"] as? Number ?: it["value"] as? Number)?.toDouble() }
    d is List<*> || (d != null && d.javaClass.name == "org.json.JSONArray") -> (awcList(d).getOrNull(1) as? Number)?.toDouble()
    else -> null
}

fun chartDataTable(kind: ChartKind, pr: ChartProps, formatters: ChartFormatters): ChartDataTable? {
    if (kind == ChartKind.SPARKLINE) return null
    val locale = pr.str("locale", ""); val name = pr.str("label", "")
    fun value(v: Double?): String = if (v == null) "—" else formatters.valueFormatter?.invoke(v) ?: ChartIntl.number(v, locale)
    if (kind == ChartKind.PIE) {
        val data = awcList(pr.obj("data")); if (data.isEmpty()) return null
        val values = data.map { chartTableValue(it) }; val total = values.filterNotNull().sum()
        val rows = data.take(CHART_TABLE_MAX).mapIndexed { i, d ->
            val m = awcMap(d)
            val label = listOf("label", "name", "x").firstNotNullOfOrNull { k -> m[k]?.let { chartJsString(it) }?.takeIf { it.isNotEmpty() } } ?: (d as? String) ?: (i + 1).toString()
            val v = values[i]; val share = v?.let { if (total > 0) it / total * 100 else 0.0 }
            listOf(label, value(v), share?.let { ChartIntl.number(it, locale, 0, 1) + "%" } ?: "—")
        }
        return ChartDataTable(name, listOf(chartTableLabel(pr, "category") ?: "Category", chartTableLabel(pr, "value") ?: "Value", chartTableLabel(pr, "share") ?: "Share"), rows)
    }
    fun label(k: String) = if (kind == ChartKind.BAR) null else chartTableLabel(pr, k)
    val series = awcList(pr.obj("series")); val xAxis = awcMap(pr.obj("xAxis"))
    val axisData = (xAxis["data"] as? List<*>)?.mapNotNull { chartAxisValue(it) } ?: awcList(xAxis["data"]).mapNotNull { chartAxisValue(it) }
    // md-line-chart reads the merged axis (point data adds its x values); the others their x axis data.
    val merged = if (kind == ChartKind.LINE) chartNormalizeSeriesX(series.map { awcList(awcMap(it)["data"]) }, axisData.takeIf { it.isNotEmpty() },
        ChartScaleType.of(xAxis["scale"] as? String) ?: ChartScaleType.CATEGORY) else null
    val xs: List<ChartAxisValue> = merged?.xValues ?: axisData
    val hasX = xs.isNotEmpty()
    val columns: List<List<Double?>> = series.mapIndexed { i, s -> merged?.data?.getOrNull(i)?.map { it.finite } ?: awcList(awcMap(s)["data"]).map { chartTableValue(it) } }
    val total = if (hasX) xs.size else columns.maxOfOrNull { it.size } ?: 0
    if (series.isEmpty() && !hasX) return null
    val xFormat = formatters.xAxisFormatter
    val rows = (0 until minOf(total, CHART_TABLE_MAX)).map { i ->
        listOf(if (hasX) xFormat?.invoke(xs[i]) ?: chartDefaultValueFormatter(xs[i], locale) else (i + 1).toString()) + columns.map { value(it.getOrNull(i)) }
    }
    val xTitle = (xAxis["label"] as? String)?.takeIf { it.isNotEmpty() } ?: if (hasX) label("x") ?: "X" else label("index") ?: "#"
    val seriesTitle = label("series") ?: "Series"
    val header = listOf(xTitle) + series.map { s -> awcMap(s).let { m -> listOf("label", "name").firstNotNullOfOrNull { k -> (m[k] as? String)?.takeIf { it.isNotEmpty() } } } ?: seriesTitle }
    return ChartDataTable(name, header, rows)
}

/** The table as TalkBack reads one: a collection of 1 dp cells (on screen, not painted) — headers are headings. */
@Composable internal fun ChartDataTableNodes(t: ChartDataTable, modifier: Modifier = Modifier) {
    Box(modifier.size(1.dp).semantics {
        if (t.name.isNotEmpty()) contentDescription = t.name
        collectionInfo = CollectionInfo(rowCount = t.rows.size + 1, columnCount = t.header.size)
    }) {
        t.header.forEachIndexed { c, h -> Box(Modifier.size(1.dp).semantics { text = AnnotatedString(h); heading(); collectionItemInfo = CollectionItemInfo(0, 1, c, 1) }) }
        t.rows.forEachIndexed { r, row ->
            row.forEachIndexed { c, v -> Box(Modifier.size(1.dp).semantics { text = AnnotatedString(v); if (c == 0) heading(); collectionItemInfo = CollectionItemInfo(r + 1, 1, c, 1) }) }
        }
    }
}
