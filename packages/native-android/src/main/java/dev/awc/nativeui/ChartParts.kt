package dev.awc.nativeui

import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.LocalTextStyle
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.layout.layout
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.awc.nativeui.charts.chartCssColor

/**
 * The exported `::part()` targets of md-line-chart / md-area-chart / md-bar-chart (header, canvas, empty, loading, footer and
 * the zoom strip: zoom, zoom-slider, zoom-pan, zoom-band and md-slider's zoom-track / zoom-window / zoom-handle),
 * md-pie-chart (header, canvas, center, empty, loading, footer) and md-sparkline (canvas).
 */
enum class AWCChartPart(val part: String) {
    HEADER("header"), CANVAS("canvas"), EMPTY("empty"), LOADING("loading"), FOOTER("footer"), CENTER("center"),
    ZOOM("zoom"), ZOOM_SLIDER("zoom-slider"), ZOOM_PAN("zoom-pan"), ZOOM_BAND("zoom-band"), ZOOM_TRACK("zoom-track"), ZOOM_WINDOW("zoom-window"), ZOOM_HANDLE("zoom-handle");
    companion object { fun of(name: String): AWCChartPart? = entries.firstOrNull { it.part == name } }
}
/** The shared sparse part vocabulary (the md-table family's AWCTablePartStyle): a chart part's `::part()` declarations. */
typealias AWCPartStyle = AWCTablePartStyle
typealias AWCChartPartAppearance = AWCTablePartStyle
/** A `::part()` rule body (`color:#B71C1C;padding:6px 12px`). */
fun AWCTablePartStyle.Companion.css(body: String): AWCTablePartStyle =
    declarations(body.split(';').mapNotNull { d -> d.split(':', limit = 2).takeIf { it.size == 2 && it[0].isNotBlank() }?.let { it[0].trim().lowercase() to it[1].trim() } }.toMap())

/** The node id of the chart being composed (for targeted part rules in its inner layers). */
internal val LocalAWCChartNodeId = staticCompositionLocalOf { "" }
internal val LocalAWCChartParts = staticCompositionLocalOf { emptyMap<AWCChartPart, AWCTablePartStyle>() }
internal val LocalAWCChartPartTargets = staticCompositionLocalOf { emptyMap<String, Map<AWCChartPart, AWCTablePartStyle>>() }
/** `::part()` styling for the charts inside [content] (`id`: only the chart with that node id). */
@Composable fun AWCChartPartAppearanceScope(styles: Map<AWCChartPart, AWCChartPartAppearance>, id: String? = null, content: @Composable () -> Unit) {
    if (id != null) {
        val t = LocalAWCChartPartTargets.current; val own = (t[id] ?: emptyMap()).toMutableMap()
        for ((p, st) in styles) own[p] = (own[p] ?: AWCTablePartStyle()).merging(st)
        CompositionLocalProvider(LocalAWCChartPartTargets provides t + (id to own), content = content)
    } else {
        val all = LocalAWCChartParts.current.toMutableMap(); for ((p, st) in styles) all[p] = (all[p] ?: AWCTablePartStyle()).merging(st)
        CompositionLocalProvider(LocalAWCChartParts provides all, content = content)
    }
}
/** A part's effective declarations for the chart with node id [id]. */
@Composable @ReadOnlyComposable internal fun chartPart(part: AWCChartPart, id: String): AWCTablePartStyle {
    val base = LocalAWCChartParts.current[part] ?: AWCTablePartStyle()
    return LocalAWCChartPartTargets.current[id]?.get(part)?.let { base.merging(it) } ?: base
}
/** A part's inherited text styles (colour, font size / weight) for slotted content inside it. */
@Composable internal fun ChartPartText(style: AWCTablePartStyle, content: @Composable () -> Unit) {
    val color = style.color?.let { chartCssColor(it) } ?: LocalContentColor.current
    val base = LocalTextStyle.current
    val ts = base.copy(fontSize = style.fontSize?.sp ?: base.fontSize,
        fontWeight = style.fontWeight?.let { androidx.compose.ui.text.font.FontWeight(it.toInt().coerceIn(1, 1000)) } ?: base.fontWeight)
    CompositionLocalProvider(LocalContentColor provides color, LocalTextStyle provides ts, content = content)
}
/** The inset of the chart's empty / loading layer (its padding box) that slotted content may fill. */
internal val LocalAWCChartLayerInset = staticCompositionLocalOf { 0.dp }
/**
 * Slotted content positioned like `position: absolute; inset: 0` inside the chart's empty / loading layer: it fills the
 * layer's padding box (the layer pads its own default content).
 */
fun Modifier.awcChartLayerFill(): Modifier = composed {
    val inset = LocalAWCChartLayerInset.current
    layout { m, c ->
        val i = inset.roundToPx()
        val p = m.measure(Constraints.fixed((c.maxWidth + 2 * i).coerceAtLeast(0), (c.maxHeight + 2 * i).coerceAtLeast(0)))
        layout(c.maxWidth, c.maxHeight) { p.place(-i, -i) }
    }
}
