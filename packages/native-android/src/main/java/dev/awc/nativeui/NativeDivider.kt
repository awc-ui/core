package dev.awc.nativeui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.material3.LocalTextStyle
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.roundToInt

internal data class NativeDividerMetrics(val vertical: Boolean, val thickness: Double, val start: Double, val end: Double) {
    companion object {
        fun from(properties: Map<String, AWCValue>, appearance: AWCDividerAppearance): NativeDividerMetrics {
            val a = appearance.normalized()
            val both = properties["inset"] == true
            val startOnly = properties["insetStart"] == true
            val endOnly = properties["insetEnd"] == true
            return NativeDividerMetrics(properties["vertical"] == true, a.thickness ?: 1.0,
                if (!endOnly && (both || startOnly)) a.insetStart ?: 16.0 else 0.0,
                if (endOnly || (both && !startOnly)) a.insetEnd ?: 16.0 else 0.0)
        }
    }
}

@Composable
internal fun NativeDivider(properties: Map<String, AWCValue>) {
    if (properties["hidden"] == true) return
    val appearance = LocalAWCDividerAppearance.current.normalized()
    val m = NativeDividerMetrics.from(properties, appearance)
    val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl
    val direction = if (rtl) "rtl" else "ltr"
    val inspection = LocalAWCInspection.current
    // forced-colors: `.md-divider__line { background-color: CanvasText }`.
    val color = awcForcedColors()?.let { awcColor(it.canvasText, Color.White) } ?: appearance.color?.let { Color(0xFF000000L or it.drop(1).toLong(16)) }
        ?: MaterialTheme.colorScheme.outlineVariant
    val minimumLength = LocalTextStyle.current.fontSize.takeIf { it.isSp } ?: 16.sp
    val density = LocalDensity.current.density.toDouble()
    fun pixels(value: Double) = (value * density).coerceIn(-32766.0, 32766.0).roundToInt()
    val appliedStart = pixels(m.start) / density
    val appliedEnd = pixels(m.end) / density
    val margin = if (m.vertical) AWCInspectionInsets(top = appliedStart, bottom = appliedEnd)
        else AWCInspectionInsets(left = if (rtl) appliedEnd else appliedStart, right = if (rtl) appliedStart else appliedEnd)
    Layout(
        modifier = Modifier.semantics {
            contentDescription = "Separator"
            stateDescription = if (m.vertical) "Vertical" else "Horizontal"
        }.inspectAWCNode(inspection, "", "md-divider",
            AWCInspectionMetrics(padding = AWCInspectionInsets(), margin = AWCInspectionInsets(),
                border = AWCInspectionInsets(), display = "Compose Layout", direction = direction)),
        content = {
            Box(Modifier.background(color).inspectAWCNode(inspection, "divider", "md-divider ::part(divider)",
                AWCInspectionMetrics(margin = margin, display = "Compose Box", direction = direction)))
        }
    ) { measurables, constraints ->
        // Compose has finite integer layout coordinates. Keep hostile/unrepresentable
        // inputs inside its supported two-dimensional Constraints range.
        val thickness = pixels(m.thickness).coerceAtLeast(0)
        val width = if (m.vertical) thickness else if (constraints.hasBoundedWidth) constraints.maxWidth else constraints.minWidth
        val height = if (m.vertical) maxOf(minimumLength.roundToPx(),
            if (constraints.hasBoundedHeight) constraints.maxHeight else constraints.minHeight) else thickness
        val start = pixels(m.start)
        val end = pixels(m.end)
        val lineWidth = (if (m.vertical) width else width - start - end).coerceIn(0, 32766)
        val lineHeight = (if (m.vertical) height - start - end else height).coerceIn(0, 32766)
        val line = measurables.single().measure(Constraints.fixed(lineWidth, lineHeight))
        layout(width, height) {
            line.place(x = if (m.vertical) 0 else if (rtl) width - start - lineWidth else start, y = if (m.vertical) start else 0)
        }
    }
}
