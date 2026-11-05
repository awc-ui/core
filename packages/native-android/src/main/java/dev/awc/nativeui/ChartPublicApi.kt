package dev.awc.nativeui

import android.graphics.Bitmap
import android.util.Base64
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Canvas
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.graphics.drawscope.CanvasDrawScope
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.LayoutDirection
import dev.awc.nativeui.charts.ChartController
import dev.awc.nativeui.charts.chartDrawScene
import java.io.ByteArrayOutputStream
import kotlin.math.abs

// Public native API of md-line-chart, md-area-chart, md-bar-chart, md-pie-chart and md-sparkline: typed hook appearances
// (the `--md-<chart>-*` custom properties, inherited like CSS — nearer values win, the host's own inline `style` wins over
// all) and the method controller. Lengths are dp (= CSS px), durations ms.

private class HookText { val css = LinkedHashMap<String, String>()
    fun n(v: Double) = if (!v.isFinite()) "invalid" else if (v == Math.rint(v) && abs(v) < 1e15) v.toLong().toString() else v.toString()
    fun text(k: String, v: String?) { if (v != null) css[k] = v }
    fun px(k: String, v: Double?) { if (v != null) css[k] = if (v.isFinite()) n(v) + "px" else "invalid" }
    fun plain(k: String, v: Double?) { if (v != null) css[k] = n(v) }
    fun ms(k: String, v: Double?) { if (v != null) css[k] = if (v.isFinite()) n(v) + "ms" else "invalid" }
}
private fun num(values: Map<String, AWCValue>, k: String) = (values[k] as? Number)?.toDouble()
private fun str(values: Map<String, AWCValue>, k: String) = values[k] as? String

/** Theme tokens, then the appearance hooks (full names), then the custom properties of the host's inline `style`. */
internal fun awcEffectiveTokens(tokens: Map<String, String>, hooks: Map<String, String>, style: String?): Map<String, String> {
    if (hooks.isEmpty() && style.isNullOrBlank()) return tokens
    val out = HashMap(tokens); out.putAll(hooks)
    for (part in style.orEmpty().split(';')) { val i = part.indexOf(':'); if (i > 0) { val k = part.substring(0, i).trim(); if (k.startsWith("--")) out[k] = part.substring(i + 1).trim() } }
    return out
}

/** Typed `--md-<chart>-*` hooks shared by the five chart elements (sparkline: blockSize, inlineSize, minInlineSize; pie: centerColor). */
class AWCChartAppearance private constructor(val css: Map<String, String>) {
    constructor(blockSize: Double? = null, minBlockSize: Double? = null, aspectRatio: String? = null, background: String? = null, padding: Double? = null,
                shape: Double? = null, emptyColor: String? = null, emptyBackground: String? = null, emptyFont: String? = null, emptyFontSize: Double? = null,
                emptyIconSize: Double? = null, zoomSize: Double? = null, zoomTrackColor: String? = null, zoomWindowColor: String? = null,
                zoomHandleColor: String? = null, zoomBandColor: String? = null, centerColor: String? = null, inlineSize: Double? = null, minInlineSize: Double? = null)
        : this(HookText().apply {
            px("block-size", blockSize); px("min-block-size", minBlockSize); text("aspect-ratio", aspectRatio); text("background", background); px("padding", padding)
            px("shape", shape); text("empty-color", emptyColor); text("empty-background", emptyBackground); text("empty-font", emptyFont); px("empty-font-size", emptyFontSize)
            px("empty-icon-size", emptyIconSize); px("zoom-size", zoomSize); text("zoom-track-color", zoomTrackColor); text("zoom-window-color", zoomWindowColor)
            text("zoom-handle-color", zoomHandleColor); text("zoom-band-color", zoomBandColor); text("center-color", centerColor); px("inline-size", inlineSize)
            px("min-inline-size", minInlineSize) }.css)
    fun merging(o: AWCChartAppearance) = AWCChartAppearance(css + o.css)
    fun merge(o: AWCChartAppearance) = merging(o)
    internal fun hooks(prefix: String): Map<String, String> = css.mapKeys { "--$prefix-${it.key}" }
    override fun equals(other: Any?) = other is AWCChartAppearance && other.css == css
    override fun hashCode() = css.hashCode()
    override fun toString() = "AWCChartAppearance($css)"
    companion object {
        val SUFFIXES = listOf("block-size", "min-block-size", "aspect-ratio", "background", "padding", "shape", "empty-color", "empty-background", "empty-font",
            "empty-font-size", "empty-icon-size", "zoom-size", "zoom-track-color", "zoom-window-color", "zoom-handle-color", "zoom-band-color", "center-color", "inline-size", "min-inline-size")
        /** Raw custom-property text by suffix, exactly as the source reads it. */
        fun fromCss(values: Map<String, String>) = AWCChartAppearance(values.filterKeys { it in SUFFIXES })
        /** Laboratory/source names (`blockSize`, `zoomTrackColor`, …; lengths as numbers in px). */
        fun fromValues(v: Map<String, AWCValue>) = AWCChartAppearance(num(v, "blockSize"), num(v, "minBlockSize"), str(v, "aspectRatio") ?: num(v, "aspectRatio")?.let { HookText().n(it) },
            str(v, "background"), num(v, "padding"), num(v, "shape"), str(v, "emptyColor"), str(v, "emptyBackground"), str(v, "emptyFont"), num(v, "emptyFontSize"),
            num(v, "emptyIconSize"), num(v, "zoomSize"), str(v, "zoomTrackColor"), str(v, "zoomWindowColor"), str(v, "zoomHandleColor"), str(v, "zoomBandColor"),
            str(v, "centerColor"), num(v, "inlineSize"), num(v, "minInlineSize"))
    }
}


/**
 * The methods of a chart element (bind with [AWCChartControllerScope]): replay(), setZoom(startIndex, endIndex), resetZoom(),
 * drill(index, direction), refreshTheme(), resize() and toDataURL() (the canvas layer — plot geometry without the text
 * overlay — as a PNG data URL at the screen density). getInstance() has no native counterpart (the Web engine object).
 */
class AWCChartController {
    internal var state: ChartController? = null
    internal var perform: ((() -> Unit) -> Unit)? = null
    internal var density: Float = 2f
    val isConnected: Boolean get() = state != null
    private fun run(block: (ChartController) -> Unit) { val s = state ?: return; val p = perform; if (p != null) p { block(s) } else s.perform { block(s) } }
    fun replay() = run { s -> s.activePlot?.replay(); s.pie?.replay() }
    fun setZoom(startIndex: Double, endIndex: Double) = run { s -> s.activePlot?.setZoom(startIndex, endIndex) }
    fun resetZoom() = run { s -> s.activePlot?.resetZoom() }
    fun drill(index: Int, direction: String = "down") = run { s -> s.drill(index, if (direction == "up") "up" else "down") }
    /** Theme tokens and hooks are read on every composition: the call re-renders, like the source's style re-read. */
    fun refreshTheme() = run { }
    /** The plot follows the composable's size: the call re-renders, like the source's ResizeObserver path. */
    fun resize() = run { }
    fun toDataURL(): String {
        val s = state ?: return "data:,"
        val fr = s.frame(s.now()) ?: return "data:,"
        val w = (fr.scene.width * density).toInt(); val h = (fr.scene.height * density).toInt()
        if (w < 1 || h < 1) return "data:,"
        val bmp = ImageBitmap(w, h)
        CanvasDrawScope().draw(Density(density), LayoutDirection.Ltr, Canvas(bmp), Size(w.toFloat(), h.toFloat())) { chartDrawScene(fr.scene, density) }
        val out = ByteArrayOutputStream(); bmp.asAndroidBitmap().compress(Bitmap.CompressFormat.PNG, 100, out)
        return "data:image/png;base64," + Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
    }
}

internal val LocalAWCChartAppearance = staticCompositionLocalOf { AWCChartAppearance() }
internal val LocalAWCChartController = staticCompositionLocalOf<AWCChartController?> { null }

/** Applies chart hook values to the charts below (nearer values win, like the inherited custom properties). */
@Composable fun AWCChartAppearanceScope(appearance: AWCChartAppearance, content: @Composable () -> Unit) =
    CompositionLocalProvider(LocalAWCChartAppearance provides LocalAWCChartAppearance.current.merging(appearance), content = content)
/** Binds the chart methods to the chart below. */
@Composable fun AWCChartControllerScope(controller: AWCChartController, content: @Composable () -> Unit) =
    CompositionLocalProvider(LocalAWCChartController provides controller, content = content)
