package dev.awc.playground

import androidx.compose.runtime.Composable
import dev.awc.nativeui.*
import org.json.JSONArray
import org.json.JSONObject

/** md-line/area/bar/pie-chart and md-sparkline in the Laboratory host: typed hooks (defaults first, local values win),
 *  retained updates with the source property types, and the methods with results (AWCChartController). */
internal val livePreviewChartTags = setOf("md-line-chart", "md-area-chart", "md-bar-chart", "md-pie-chart", "md-sparkline")
private val chartAppearanceKeys = mapOf("md-line-chart" to "lineChartAppearance", "md-area-chart" to "areaChartAppearance", "md-bar-chart" to "barChartAppearance",
    "md-pie-chart" to "pieChartAppearance", "md-sparkline" to "sparklineAppearance")
private val chartMethods = mapOf(
    "md-line-chart" to setOf("refreshTheme", "resize", "replay", "toDataURL", "setZoom", "resetZoom"), "md-area-chart" to setOf("refreshTheme", "resize", "replay", "toDataURL", "setZoom", "resetZoom"),
    "md-bar-chart" to setOf("refreshTheme", "resize", "replay", "drill", "toDataURL", "setZoom", "resetZoom"), "md-pie-chart" to setOf("refreshTheme", "resize", "replay", "drill", "toDataURL"),
    "md-sparkline" to setOf("refreshTheme", "resize"))
internal val livePreviewChartMethodTags = chartMethods.keys

internal class LivePreviewChartOptions(val chart: AWCChartAppearance = AWCChartAppearance())

private fun chartJson(value: Any?): Any? = when (value) {
    JSONObject.NULL -> null
    is JSONObject -> value.keys().asSequence().associateWith { chartJson(value.opt(it)) }
    is JSONArray -> List(value.length()) { chartJson(value.opt(it)) }
    is Number -> value.toDouble()
    else -> value
}
private fun chartValues(request: JSONObject, field: String): Map<String, AWCValue> {
    val obj = request.optJSONObject(field) ?: return emptyMap()
    return obj.keys().asSequence().associateWith { chartJson(obj.opt(it)) }
}
internal fun parseLivePreviewChartOptions(request: JSONObject): LivePreviewChartOptions {
    val tag = request.optString("tag"); val key = chartAppearanceKeys[tag] ?: return LivePreviewChartOptions()
    val defaults = chartValues(request, "${key}Defaults"); val local = chartValues(request, key)
    return LivePreviewChartOptions(AWCChartAppearance.fromValues(defaults).merging(AWCChartAppearance.fromValues(local)))
}

@Composable internal fun LivePreviewChartScope(o: LivePreviewChartOptions, chart: AWCChartController, content: @Composable () -> Unit) =
    AWCChartAppearanceScope(o.chart) { AWCChartControllerScope(chart) { content() } }

// Source property types (IR); closures (valueFormatter, tooltipRenderer) are native API only.
private const val COMMON = "label:s subtitle:os titleAlign:e=start|center|end legend:e=top|bottom|left|right|top-start|top-end|bottom-start|bottom-end|none tooltip:e=axis|item|none locale:s heightProp:s noAnimation:b animation:e=expressive|grow|fade|draw|stagger|none animationDuration:n density:d"
private const val CURVE = "e=linear|smooth|monotone|step|step-before|step-middle"; private const val STACK = "e=none|normal|percent|stream"
private const val GRID = "e=none|horizontal|vertical|both"; private const val ZOOM = "e=none|inside|slider|both"
private val chartSpec = mapOf(
    "md-line-chart" to "$COMMON markLines:j series:j xAxis:j yAxis:j yAxes:j curve:$CURVE stack:$STACK connectNulls:b showMarks:b lineWidth:n markSize:n area:b showLine:b grid:$GRID axisTicks:b inverted:b showLabels:b seriesLabels:b zoom:$ZOOM labelEmpty:s labelPlot:s labelPoint:s labelZoomStart:s labelZoomEnd:s summary:s tableLabels:j loading:b loadingLabel:s",
    "md-area-chart" to "$COMMON series:j xAxis:j yAxis:j curve:$CURVE stack:$STACK connectNulls:b showMarks:b lineWidth:n markSize:n zoom:$ZOOM fillOpacity:n showLine:b grid:$GRID inverted:b seriesLabels:b summary:s tableLabels:j labelEmpty:s loading:b loadingLabel:s labelZoomStart:s labelZoomEnd:s axisTicks:b showLabels:b labelPlot:s labelPoint:s",
    "md-bar-chart" to "$COMMON series:j xAxis:j yAxis:j yAxis2:j layout:e=vertical|horizontal stack:$STACK categoryGap:sn barGap:sn barWidth:n cornerRadius:n zoom:$ZOOM showLabels:b showTotals:b chevron:b polar:b polarHole:n polarSweep:n axisTicks:b clickable:b labelZoomStart:s labelZoomEnd:s labelPlot:s labelPoint:s loading:b loadingLabel:s",
    "md-pie-chart" to "$COMMON data:j innerRadius:sn outerRadius:sn startAngle:n endAngle:n paddingAngle:n cornerRadius:n showLabels:b labelMode:e=value|name|both monochrome:s gradient:b highlight:e=slice|series|none summary:s tableLabels:j labelEmpty:s loading:b loadingLabel:s labelPlot:s labelPoint:s ringWidths:j",
    "md-sparkline" to "data:j labels:j variant:e=line|bar|area color:s curve:$CURVE showTooltip:b showMarks:e=none|extremes|edges|all referenceAreas:j heightProp:s noAnimation:b cornerRadius:n min:n max:n lineWidth:n markSize:n barWidth:n",
).mapValues { (_, spec) -> spec.split(' ').associate { it.substringBefore(':') to it.substringAfter(':') } }
private fun chartText(v: Any?, limit: Int = 4096) = v is String && v.toByteArray().size <= limit
private fun chartFinite(v: Any?) = v is Number && v.toDouble().isFinite()

/** Retained property updates with the source property types. */
internal fun parseLivePreviewChartUpdate(tag: String, request: JSONObject): Map<String, AWCValue> {
    require(request.keys().asSequence().all { it in setOf("command", "properties") } && request.optString("command") == "update") { "Expected a property update." }
    val properties = request.getJSONObject("properties"); val types = chartSpec.getValue(tag)
    require(properties.length() > 0) { "A property update must contain at least one field." }
    return properties.keys().asSequence().associateWith { name ->
        val raw = properties.get(name); val type = types[name] ?: throw IllegalArgumentException("Unknown $tag property: $name")
        val ok = when (type) {
            "b" -> raw is Boolean
            "n" -> chartFinite(raw)
            "s" -> chartText(raw)
            "os" -> raw == JSONObject.NULL || chartText(raw)
            "sn" -> chartFinite(raw) || chartText(raw, 64)
            "d" -> raw is Number && raw.toDouble() in setOf(0.0, -1.0, -2.0, -3.0, -4.0)
            "j" -> raw == JSONObject.NULL || (raw is JSONArray || raw is JSONObject) && raw.toString().toByteArray().size <= 262_144
            else -> type.startsWith("e=") && raw is String && raw in type.removePrefix("e=").split('|')
        }
        require(ok) { "Invalid $tag $name." }
        chartJson(raw)
    }
}

/** The chart methods through AWCChartController; toDataURL returns the PNG data URL. */
internal fun invokeLivePreviewChartMethod(tag: String, request: JSONObject, chart: AWCChartController): Any? {
    val method = request.optString("method"); val args = request.optJSONArray("arguments") ?: JSONArray()
    require(chartMethods[tag]?.contains(method) == true) { "Unsupported native method." }
    check(chart.isConnected) { "The $tag is not mounted." }
    when (method) {
        "setZoom" -> { require(args.length() == 2 && chartFinite(args.opt(0)) && chartFinite(args.opt(1))) { "setZoom requires two numbers: startIndex and endIndex." }
            chart.setZoom(args.getDouble(0), args.getDouble(1)) }
        "drill" -> {
            val i = args.opt(0)
            require(args.length() in 1..2 && i is Number && i.toDouble() >= 0 && i.toDouble() == Math.floor(i.toDouble()) && i.toDouble() < 1e9) { "drill requires an index (an integer from 0) and optionally down or up." }
            val direction = if (args.length() == 2) args.opt(1) else "down"
            require(direction in setOf("down", "up")) { "drill direction must be down or up." }
            chart.drill(i.toInt(), direction as String)
        }
        else -> { require(args.length() == 0) { "$method requires no arguments." }
            when (method) { "replay" -> chart.replay(); "resetZoom" -> chart.resetZoom(); "refreshTheme" -> chart.refreshTheme(); "resize" -> chart.resize(); "toDataURL" -> return chart.toDataURL() } }
    }
    return null
}
