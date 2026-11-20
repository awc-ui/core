package dev.awc.nativeui

import androidx.compose.foundation.layout.absolutePadding
import androidx.compose.runtime.Immutable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.dp
import kotlin.math.min

/**
 * A wrapper part's CSS box as a typed `::part()` target (gate-7 R6-17): `background-color`, `border` (width and colour),
 * `border-radius` and the `padding` shorthand. Border and padding take layout space around the wrapper's content (the source's
 * boxes are content-box), so everything inside and after the wrapper shifts as in Chrome; the padding edges are physical (left
 * stays left in right-to-left layouts). Colours `#RRGGBB(AA)`, lengths dp. Used by md-tab `content`, md-navigation-tab
 * `container` / `icon-container`, md-breadcrumbs `overflow` and md-toolbar `fab-container`.
 */
@Immutable data class AWCPartBox(val background: String? = null, val borderWidth: Double? = null, val borderColor: String? = null,
    val cornerRadius: Double? = null, val padding: List<Double>? = null) {
    fun merging(o: AWCPartBox?) = if (o == null) this else AWCPartBox(o.background ?: background, o.borderWidth ?: borderWidth, o.borderColor ?: borderColor,
        o.cornerRadius ?: cornerRadius, o.padding ?: padding)
    internal val bg get() = awcRippleHex(background)
    internal val border get() = borderWidth?.takeIf { it.isFinite() && it >= 0 } ?: 0.0
    internal val borderInk get() = awcRippleHex(borderColor)
    internal val radius get() = cornerRadius?.takeIf { it.isFinite() && it >= 0 } ?: 0.0
    /** The padding shorthand → physical (top, right, bottom, left). */
    internal val paddingEdges: List<Double> get() {
        val p = padding?.takeIf { it.size in 1..4 && it.all { v -> v.isFinite() && v >= 0 } } ?: return listOf(0.0, 0.0, 0.0, 0.0)
        return when (p.size) { 1 -> listOf(p[0], p[0], p[0], p[0]); 2 -> listOf(p[0], p[1], p[0], p[1]); 3 -> listOf(p[0], p[1], p[2], p[1]); else -> p }
    }
    /** Border + padding per physical edge (top, right, bottom, left): the distance from the border box to the content box. */
    internal val insets: List<Double> get() = paddingEdges.map { it + border }
    internal val horizontal get() = insets[1] + insets[3]
    internal val vertical get() = insets[0] + insets[2]
    internal val paints get() = bg != null || border > 0
    /** The box as the parity probes read it; [ink] is the border colour when the part sets none (CSS `currentColor`). */
    internal fun probe(ink: Color): Map<String, Any?> = mapOf("background" to (bg ?: Color.Transparent), "borderWidth" to border,
        "borderColor" to (if (border > 0) borderInk ?: ink else Color.Transparent), "radius" to radius, "padding" to paddingEdges)
    companion object {
        /** Laboratory value: a map `{ background, borderWidth, borderColor, cornerRadius, padding }`; `padding` is one number, a list
         *  of one to four numbers (the CSS shorthand) or `{ top, right, bottom, left }`. */
        fun fromValue(v: Any?): AWCPartBox? {
            val o = v as? Map<*, *> ?: return null
            val pad = when (val p = o["padding"]) {
                is Number -> listOf(p.toDouble())
                is List<*> -> p.mapNotNull { (it as? Number)?.toDouble() }.takeIf { it.isNotEmpty() }
                is Map<*, *> -> listOf("top", "right", "bottom", "left").map { (p[it] as? Number)?.toDouble() ?: 0.0 }
                else -> null
            }
            return AWCPartBox(o["background"] as? String, (o["borderWidth"] as? Number)?.toDouble(), o["borderColor"] as? String, (o["cornerRadius"] as? Number)?.toDouble(), pad)
        }
        internal fun merge(a: AWCPartBox?, b: AWCPartBox?): AWCPartBox? = a?.merging(b) ?: b
    }
}
internal val AWCPartBox?.boxInsets: List<Double> get() = this?.insets ?: listOf(0.0, 0.0, 0.0, 0.0)
internal val AWCPartBox?.boxBorder: Double get() = this?.border ?: 0.0

/** Paints a part box in the border box at [topLeft] / [size] (px): the background under the border, both following the radius
 *  (CSS: the outer radius at the border edge, the inner one smaller by the border width). */
internal fun DrawScope.drawAWCPartBox(box: AWCPartBox, ink: Color, topLeft: Offset = Offset.Zero, size: Size = this.size) {
    if (size.width <= 0f || size.height <= 0f) return
    val r = min(box.radius.dp.toPx(), min(size.width, size.height) / 2)
    box.bg?.let { drawRoundRect(it, topLeft, size, CornerRadius(r, r)) }
    val w = box.border.dp.toPx()
    if (w > 0f) {
        val ri = (r - w / 2).coerceAtLeast(0f)
        drawRoundRect(box.borderInk ?: ink, Offset(topLeft.x + w / 2, topLeft.y + w / 2), Size((size.width - w).coerceAtLeast(0f), (size.height - w).coerceAtLeast(0f)), CornerRadius(ri, ri), style = Stroke(w))
    }
}
/** Lays the element out inside a part box (border + padding around it, physical edges) and paints the box behind it. */
internal fun Modifier.awcPartBox(box: AWCPartBox?, ink: Color): Modifier {
    if (box == null || !(box.paints || box.horizontal > 0 || box.vertical > 0)) return this
    val i = box.insets
    return (if (box.paints) drawBehind { drawAWCPartBox(box, ink) } else this).absolutePadding(left = i[3].dp, top = i[0].dp, right = i[1].dp, bottom = i[2].dp)
}
