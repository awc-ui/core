package dev.awc.nativeui

import android.os.SystemClock
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.layout
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.Dp
import dev.awc.nativeui.charts.ChartPaintMeasurer

// Compose helpers of the dedicated chart views (also used by the md-slider / md-rating renderers): the Roboto paint
// measurer, physical placement in either layout direction and a view-local frame clock.

@Composable internal fun rememberAWCPaintMeasurer(): ChartPaintMeasurer {
    val context = LocalContext.current
    return remember(context) {
        fun face(id: Int) = context.resources.getFont(id)
        ChartPaintMeasurer(face(R.font.awc_roboto_regular), face(R.font.awc_roboto_medium), face(R.font.awc_roboto_bold))
    }
}

/**
 * Places the content at the physical (x, y) of its parent box in either layout direction. The layout models already
 * return mirrored (physical) coordinates for RTL; `offset` would mirror x again (and a Box child starts at the top-right
 * corner in RTL), so positioned parts fill the parent and place their content with `place`, which never mirrors.
 */
internal fun Modifier.awcAt(x: Dp, y: Dp): Modifier = layout { measurable, constraints ->
    val p = measurable.measure(constraints.copy(minWidth = 0, minHeight = 0))
    val px = x.roundToPx(); val py = y.roundToPx()
    val w = if (constraints.hasBoundedWidth) constraints.maxWidth else px + p.width
    val h = if (constraints.hasBoundedHeight) constraints.maxHeight else py + p.height
    layout(w, h) { p.place(px, py) }
}

/** Centres the content on the physical point (x, y) of its parent box (CSS `translate(-50%, -50%)` from that point). */
internal fun Modifier.awcCenterAt(x: Dp, y: Dp): Modifier = layout { measurable, constraints ->
    val p = measurable.measure(constraints.copy(minWidth = 0, minHeight = 0))
    val w = if (constraints.hasBoundedWidth) constraints.maxWidth else p.width
    val h = if (constraints.hasBoundedHeight) constraints.maxHeight else p.height
    layout(w, h) { p.place(x.roundToPx() - p.width / 2, y.roundToPx() - p.height / 2) }
}

/** Frame clock for a view-local transition set: re-reads `now` every frame while `active` says so. */
@Composable internal fun awcMotionClock(active: () -> Boolean, version: Int): Double {
    var now by remember { mutableDoubleStateOf(SystemClock.uptimeMillis().toDouble()) }
    LaunchedEffect(version) {
        now = SystemClock.uptimeMillis().toDouble()
        while (active()) { withFrameMillis { now = SystemClock.uptimeMillis().toDouble() } }
        now = SystemClock.uptimeMillis().toDouble()
    }
    return now
}
