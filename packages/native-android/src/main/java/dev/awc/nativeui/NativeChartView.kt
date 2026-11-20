package dev.awc.nativeui

import android.graphics.Paint
import android.graphics.Typeface
import android.os.SystemClock
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.focusable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.AbsoluteAlignment
import androidx.compose.ui.Alignment
import androidx.compose.ui.layout.SubcomposeLayout
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.input.key.*
import androidx.compose.ui.input.pointer.PointerEventType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.state.ToggleableState
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.awc.nativeui.charts.*
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

// Dedicated Compose renderer for md-line-chart, md-area-chart, md-bar-chart, md-pie-chart and md-sparkline
// (lockstep with NativeChartView.swift): the ported engine's scene on a Canvas (1 CSS px = 1 dp), overlay text / bar
// labels / glyphs, legend chips, the hover layer (crosshair, markers, tooltip card), the drag-to-zoom band and zoom
// slider, the keyboard cursor and its live announcement, the entrance / drill / follow motion, and the component
// events. The state lives in ChartController (platform-neutral, shared with the JVM checks).

/** Function-valued chart properties (valueFormatter, axis formatters, tooltipRenderer); key "" = every chart below. */
val LocalAWCChartFormatters = staticCompositionLocalOf<Map<String, ChartFormatters>> { emptyMap() }

private val ChartRoboto = FontFamily(Font(R.font.awc_roboto_regular, FontWeight.Normal), Font(R.font.awc_roboto_medium, FontWeight.Medium), Font(R.font.awc_roboto_bold, FontWeight.Bold))

/** Roboto faces for the canvas text (400 / 500 / 700; 600 draws as bold, as the Web falls back). */
internal class ChartFaces(val regular: Typeface, val medium: Typeface, val bold: Typeface) {
    fun of(weight: Double) = if (weight > 500) bold else if (weight > 400) medium else regular
}

@Composable private fun rememberChartFaces(): ChartFaces {
    val context = LocalContext.current
    return remember(context) {
        fun face(id: Int) = context.resources.getFont(id)
        ChartFaces(face(R.font.awc_roboto_regular), face(R.font.awc_roboto_medium), face(R.font.awc_roboto_bold))
    }
}

/** One absolutely positioned span: `left/top` + `translate(ax, ay)` (+ rotate about the box centre). */
private fun DrawScope.chartSpan(faces: ChartFaces, measure: ChartTextMeasurer, text: String, x: Double, y: Double, ax: Double, ay: Double, size: Double, weight: Double,
                                color: String, px: Float, rotate: Double? = null, lineHeight: Double? = null, alpha: Double = 1.0) {
    val w = measure.width(text, size, weight)
    val h = lineHeight ?: measure.normalLineHeight(size, weight)
    val cx = x + w / 2 + ax * w; val cy = y + h / 2 + ay * h
    val c = chartCssColor(color)
    val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        typeface = faces.of(weight); textSize = (size * px).toFloat(); this.color = android.graphics.Color.argb((c.alpha * alpha.toFloat() * 255).toInt(), (c.red * 255).toInt(), (c.green * 255).toInt(), (c.blue * 255).toInt())
        textAlign = Paint.Align.CENTER; isSubpixelText = true
    }
    val fm = paint.fontMetrics
    drawIntoCanvas { canvas ->
        val nc = canvas.nativeCanvas
        nc.save()
        nc.translate((cx * px).toFloat(), (cy * px).toFloat())
        if (rotate != null && rotate != 0.0) nc.rotate(rotate.toFloat())
        nc.drawText(text, 0f, -(fm.ascent + fm.descent) / 2, paint)
        nc.restore()
    }
}

private fun alignX(a: String) = if (a == "center") -0.5 else if (a == "end") -1.0 else 0.0
private fun alignY(b: String) = if (b == "middle") -0.5 else if (b == "bottom") -1.0 else 0.0
private fun pct(s: String) = if (s.endsWith("%")) jsParseFloat(s.dropLast(1)) / 100 else 0.0

/** overlay.ts syncOverlay / renderGlyphs / renderEndLabels; `pieLabelAlpha` holds the pie's slice labels back (paceLabels). */
private fun DrawScope.chartDrawOverlay(scene: ChartScene, faces: ChartFaces, measure: ChartTextMeasurer, px: Float, pieLabelAlpha: Double) {
    for (t in scene.texts)
        chartSpan(faces, measure, t.text, t.x, t.y, alignX(t.align), alignY(t.baseline), t.fontSize, t.fontWeight ?: 400.0, t.color, px, t.rotate,
            alpha = if (t.key.startsWith("pl-")) pieLabelAlpha else 1.0)
    for (g in scene.glyphs ?: emptyList()) {
        val l = g.label
        if (l != null) chartSpan(faces, measure, g.text, g.x + l.dx, g.y + l.dy, pct(l.anchorX), pct(l.anchorY), g.size, l.weight, l.color, px, lineHeight = g.size)
        else chartSpan(faces, measure, g.text, g.x, g.y, -0.5, -0.5, g.size, 400.0, "#000000", px, lineHeight = g.size)
    }
    for (e in scene.endLabels ?: emptyList()) if (e.visible) {
        val end = e.side == "end"
        chartSpan(faces, measure, e.text, if (end) e.x - 12 else e.x + 12, e.y, if (end) -1.0 else 0.0, -0.5, e.size, 500.0, e.color, px)
    }
}

/** overlay.ts renderBarLabels: re-placed from the bars' current geometry every frame. */
private fun DrawScope.chartDrawBarLabels(scene: ChartScene, faces: ChartFaces, measure: ChartTextMeasurer, px: Float) {
    for (bl in scene.barLabels ?: emptyList()) {
        val pieces = scene.bars.filter { it.seriesIndex == bl.seriesIndex && it.dataIndex == bl.dataIndex }
        val first = pieces.firstOrNull() ?: continue
        val horizontal = first.horizontal == true
        val loX = pieces.minOf { it.x }; val hiX = pieces.maxOf { it.x + it.w }; val loY = pieces.minOf { it.y }; val hiY = pieces.maxOf { it.y + it.h }
        var x: Double; var y: Double; val ax: Double; val ay: Double
        if (bl.inside == true) {
            x = (loX + hiX) / 2; y = (loY + hiY) / 2; ax = -0.5; ay = -0.5
            val arrow = first.arrow
            if (arrow != null && arrow != 0) {
                val tip = chartChevronTipDepth(if (horizontal) hiY - loY else hiX - loX)
                val cut = if (first.notch == false) 0.0 else tip
                val shift = arrow * (tip + cut) / 2
                if (horizontal) x += shift else y -= shift
            }
        } else if (horizontal) { y = (loY + hiY) / 2; ay = -0.5; x = if (bl.atLowEnd == true) loX - 4 else hiX + 4; ax = if (bl.atLowEnd == true) -1.0 else 0.0 }
        else { x = (loX + hiX) / 2; ax = -0.5; y = if (bl.atLowEnd == true) hiY + 4 else loY - 4; ay = if (bl.atLowEnd == true) 0.0 else -1.0 }
        chartSpan(faces, measure, bl.text, x, y, ax, ay, bl.size, bl.fontWeight ?: 400.0, bl.color, px)
    }
}

private fun chartKeyName(e: KeyEvent): String? = when (e.key) {
    Key.DirectionLeft -> "ArrowLeft"; Key.DirectionRight -> "ArrowRight"; Key.DirectionUp -> "ArrowUp"; Key.DirectionDown -> "ArrowDown"
    Key.MoveHome -> "Home"; Key.MoveEnd -> "End"; Key.Escape -> "Escape"; Key.Enter, Key.NumPadEnter -> "Enter"; Key.Spacebar -> " "; else -> null
}

@Composable internal fun NativeChartView(tag: String, p: Props, emit: EventSink, slot: Slot? = null) {
    val kind = ChartKind.of(tag)
    // Theme tokens, then the typed hooks (AWCChartAppearanceScope), then the host's inline `style` custom properties.
    val tokens = awcEffectiveTokens(LocalAWCThemeTokens.current, LocalAWCChartAppearance.current.hooks(kind.prefix), p.str("style"))
    val inherited = LocalAWCNativeDensity.current
    val density = if (kind == ChartKind.SPARKLINE) inherited else resolveAWCDensity(p["density"], inherited)
    val formatters = LocalAWCChartFormatters.current.let { it[p.str("id")] ?: it[""] ?: ChartFormatters() }
    val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl
    val (reduced, _) = rememberAWCAccessibilityAppearance()
    val measurer = rememberAWCPaintMeasurer()
    val faces = rememberChartFaces()
    val view = LocalView.current
    val ctl = remember(kind) { ChartController(measurer) }
    var version by remember { mutableIntStateOf(0) }
    fun perform(body: () -> Unit) { ctl.perform(body); version++ }
    ctl.now = { SystemClock.uptimeMillis().toDouble() }
    ctl.dispatch = { _, name, detail -> emit(name, detail) }
    ctl.announce = { text -> view.announceForAccessibility(text) }
    val publicController = LocalAWCChartController.current
    val screenDensity = LocalDensity.current.density
    DisposableEffect(publicController, ctl) {
        publicController?.let { it.state = ctl; it.perform = { b -> perform(b) }; it.density = screenDensity }
        onDispose { if (publicController?.state === ctl) { publicController.state = null; publicController.perform = null } }
    }
    val host = ChartHostMetrics.of(kind, tokens, density)
    val pr = ChartProps(p)
    // The host's own inline layout CSS (`style="block-size:360px"` / `height:`) sizes it like the source's host CSS.
    val styleHeight = p.str("style").split(';').firstNotNullOfOrNull { d -> d.split(':', limit = 2).takeIf { it.size == 2 && it[0].trim() in setOf("block-size", "height") }?.let { chartCssPixels(it[1].trim()) } }
    val nodeId = p.str("id")
    val headerPart = chartPart(AWCChartPart.HEADER, nodeId); val footerPart = chartPart(AWCChartPart.FOOTER, nodeId)
    val canvasPart = chartPart(AWCChartPart.CANVAS, nodeId); val centerPart = chartPart(AWCChartPart.CENTER, nodeId)
    val emptyPart = chartPart(AWCChartPart.EMPTY, nodeId); val loadingPart = chartPart(AWCChartPart.LOADING, nodeId)
    val zoomPart = chartPart(AWCChartPart.ZOOM, nodeId)
    val zoomParts = listOf(AWCChartPart.ZOOM_SLIDER, AWCChartPart.ZOOM_PAN, AWCChartPart.ZOOM_TRACK, AWCChartPart.ZOOM_WINDOW, AWCChartPart.ZOOM_HANDLE).associateWith { chartPart(it, nodeId) }
    val explicitHeight = styleHeight ?: if (kind == ChartKind.SPARKLINE) chartCssPixels(pr.str("height", "").ifEmpty { null }) ?: chartCssPixels(tokens["--md-sparkline-block-size"]) ?: 28.0
                         else chartCssPixels(pr.str("height", "").ifEmpty { null }) ?: chartCssPixels(tokens["--${kind.prefix}-block-size"])
    val zoomSliderOn = (kind == ChartKind.LINE || kind == ChartKind.AREA || (kind == ChartKind.BAR && !pr.bool("polar"))) && pr.str("zoom", "none") in setOf("slider", "both")
    // ::part(zoom) block padding adds to the strip's height (the plot shrinks by as much).
    // The reserved zoom band (--_zoom-size). ::part(zoom) is absolutely positioned at the bottom with a content-box block-size:
    // its vertical padding grows the strip upward over the plot without moving the plot.
    val zoomSize = chartCssPixels(tokens["--${kind.prefix}-zoom-size"]) ?: 28.0
    val zoomPadV = (zoomPart.padding?.top ?: 0.0) + (zoomPart.padding?.bottom ?: 0.0)
    val loading = pr.bool("loading")
    val isEmpty = when (kind) { ChartKind.PIE -> awcList(pr.obj("data")).isEmpty() && !loading; ChartKind.SPARKLINE -> false; else -> awcList(pr.obj("series")).isEmpty() && !loading }
    val now = awcMotionClock({ ctl.animating }, version)

    BoxWithConstraints(Modifier.fillMaxWidth()) {
        val w = maxWidth.value.toDouble()
        val h = explicitHeight ?: max(host.minHeight, w / max(0.01, host.aspect))
        val plotW = max(0.0, w - 2 * host.padding)
        val plotH = max(0.0, h - 2 * host.padding - if (zoomSliderOn) zoomSize else 0.0)
        ctl.sync(kind, p, tokens, density, formatters, plotW, plotH, rtl, reduced)
        Box(Modifier.size(w.dp, h.dp).background(chartCssColor(host.background), RoundedCornerShape(host.shape.dp))
            .inspectAWCNode(LocalAWCInspection.current, "", tag, AWCInspectionMetrics(padding = AWCInspectionInsets(host.padding, host.padding, host.padding, host.padding),
                display = "Compose Box", direction = if (rtl) "rtl" else "ltr"))
            // md-sparkline is an image (role="img"): one leaf node, so TalkBack and the hierarchy report an ImageView.
            .then(if (kind == ChartKind.SPARKLINE) Modifier.clearAndSetSemantics { contentDescription = chartSummary(kind, pr, formatters); role = Role.Image }
                  else Modifier.semantics { contentDescription = chartSummary(kind, pr, formatters) })) {
            // header / footer slots: in-flow blocks (margin-block 8px, collapsing) inside the padding, under the absolutely
            // positioned canvas, which covers the whole padding box (chart CSS) — so they share its top.
            if (slot != null && kind != ChartKind.SPARKLINE)
                Column(Modifier.awcAt(host.padding.dp, (host.padding + 8).dp).width(plotW.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) { ChartPartText(headerPart) { slot("header") }; ChartPartText(footerPart) { slot("footer") } }
            if (plotW >= 2 && plotH >= 2) {
                // `version` is passed down: the controller is a plain object, so its changes reach the (skippable) layers only this way.
                CompositionLocalProvider(LocalAWCChartNodeId provides nodeId) { ChartPlot(ctl, version, kind, tokens, faces, measurer, plotW, plotH, now, enabled = kind != ChartKind.SPARKLINE && !isEmpty, rtl = rtl, perform = ::perform,
                    label = pr.str("labelPlot", if (kind == ChartKind.PIE) "Chart data. Use the arrow keys to move between slices, Home and End for the first and last, Escape to leave."
                                                else "Chart data. Use the arrow keys to move between points, Home and End for the first and last, Escape to leave."),
                    modifier = Modifier.offset(host.padding.dp, host.padding.dp)
                        .then(canvasPart.opacity?.let { Modifier.alpha(it.toFloat()) } ?: Modifier)
                        .then(canvasPart.backgroundColor?.let { Modifier.background(chartCssColor(it), RoundedCornerShape((canvasPart.cornerRadius ?: 0.0).dp)) } ?: Modifier)) }
                if (zoomSliderOn) ChartZoomSlider(ctl, version, tokens, kind.prefix, rtl, pr, ::perform, Modifier.offset(host.padding.dp, (host.padding + plotH - zoomPadV).dp).size(plotW.dp, (zoomSize + zoomPadV).dp).tablePartBox(zoomPart, rtl), zoomParts)
            }
            // The screen-reader data table (the Web's visually hidden table after the plot): TalkBack's table of the chart's data.
            if (!isEmpty) chartDataTable(kind, pr, formatters)?.let { ChartDataTableNodes(it, Modifier.offset(host.padding.dp, max(0.0, h - host.padding - 1).dp)) }
            if (kind == ChartKind.PIE && slot != null) ctl.pie?.scene?.let { scene ->
                // md-pie-chart's centre slot: centred on the ring's computed centre (getCenter(), canvas-relative, plus the
                // padding), capped at the hole (getHoleBox()); physical coordinates in either direction.
                val c = scene.pieCenterSlot ?: ChartPt(scene.plot.x + scene.plot.width / 2, scene.plot.y + scene.plot.height / 2)
                val holeW = scene.pieHoleSize ?: 0.0; val holeH = scene.pieHoleHeight ?: 0.0
                val ink = chartCssColor(centerPart.color ?: tokens["--md-pie-chart-center-color"]?.takeIf { it.isNotBlank() } ?: chartToken(tokens, "--md-sys-color-on-surface", "#1C1B1F"))
                CompositionLocalProvider(LocalContentColor provides ink) {
                    Box(Modifier.awcCenterAt((host.padding + c.x).dp, (host.padding + c.y).dp)
                        .widthIn(max = if (holeW > 0) holeW.dp else Dp.Infinity).heightIn(max = if (holeH > 0) holeH.dp else Dp.Infinity),
                        contentAlignment = Alignment.Center) { Box(Modifier.tablePartBox(centerPart.copy(color = null), rtl)) { ChartPartText(centerPart.copy(color = null)) { slot("center") } } }
                }
            }
            if (isEmpty || loading) {
                val lp = if (loading) loadingPart else emptyPart
                val pad = lp.padding ?: AWCTableEdges(24.0, 24.0, 24.0, 24.0)
                Box(Modifier.matchParentSize().then(lp.opacity?.let { Modifier.alpha(it.toFloat()) } ?: Modifier)
                    .background(chartCssColor(lp.backgroundColor ?: host.emptyBackground), RoundedCornerShape((lp.cornerRadius ?: host.shape).dp))
                    .padding(PaddingValues((if (rtl) pad.right else pad.left).dp, pad.top.dp, (if (rtl) pad.left else pad.right).dp, pad.bottom.dp)), contentAlignment = Alignment.Center) {
                  CompositionLocalProvider(LocalAWCChartLayerInset provides pad.top.dp) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        val ink = chartCssColor(lp.color ?: host.emptyColor)
                        if (loading) {
                            // The loader / loading slot replaces the built-in spinner and label only when it has content.
                            ChartSlotOrDefault(slot, if (slot != null) "loader" else "") {
                                ChartSlotOrDefault(slot, "loading") {
                                    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                        val loadingLabel = pr.str("loadingLabel", "Loading chart…")
                                        CircularProgressIndicator(Modifier.size(40.dp).semantics { contentDescription = loadingLabel }, color = ink)
                                        Text(loadingLabel, color = ink, fontFamily = ChartRoboto, modifier = Modifier.clearAndSetSemantics { })
                                    }
                                }
                            }
                        } else {
                            CompositionLocalProvider(LocalContentColor provides ink) {
                                ChartSlotOrDefault(slot, "empty") { Text(pr.str("labelEmpty", "No data to display"), color = ink, fontFamily = ChartRoboto,
                                    fontSize = (lp.fontSize ?: chartCssPixels(tokens["--${kind.prefix}-empty-font-size"]) ?: 14.0).sp) }
                            }
                        }
                    }
                  }
                }
            }
            // The subtitle is the overlay's DOM text on the Web (drawn on the canvas here): exposed as text. Composed last: a
            // node that a later sibling covers (the plot, the empty / loading overlay) is left out of the accessibility tree.
            pr.str("subtitle", "").takeIf { it.isNotEmpty() && kind != ChartKind.SPARKLINE }?.let { sub ->
                Box(Modifier.awcAt(host.padding.dp, host.padding.dp).size(1.dp).semantics { text = AnnotatedString(sub) })
            }
        }
    }
}

/** Renders the named slot; when it composes nothing (an empty slot), the [fallback] — the source's default slot content. */
@Composable private fun ChartSlotOrDefault(slot: Slot?, name: String, fallback: @Composable () -> Unit) {
    if (slot == null || name.isEmpty()) { fallback(); return }
    SubcomposeLayout { constraints ->
        val loose = constraints.copy(minWidth = 0, minHeight = 0)
        val own = subcompose("slot") { Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) { slot(name) } }.map { it.measure(loose) }
        val shown = if (own.all { it.width == 0 && it.height == 0 }) subcompose("fallback", fallback).map { it.measure(loose) } else own
        layout(shown.maxOfOrNull { it.width } ?: 0, shown.maxOfOrNull { it.height } ?: 0) { shown.forEach { it.place(0, 0) } }
    }
}

@Composable private fun ChartPlot(ctl: ChartController, version: Int, kind: ChartKind, tokens: Map<String, String>, faces: ChartFaces, measure: ChartTextMeasurer,
                                  w: Double, h: Double, now: Double, enabled: Boolean, rtl: Boolean, perform: (() -> Unit) -> Unit, label: String, modifier: Modifier) {
    val px = LocalDensity.current.density
    var tip by remember { mutableStateOf(IntSize.Zero) }
    val frame = ctl.frame(now)
    val announcement = ctl.announcement
    Box(modifier.size(w.dp, h.dp)) {
    Box(Modifier.matchParentSize()
        .onFocusChanged { f -> if (!f.isFocused) perform { ctl.activePlot?.blur(); ctl.pie?.blur() } }
        .onPreviewKeyEvent { e ->
            if (!enabled || e.type != KeyEventType.KeyDown) return@onPreviewKeyEvent false
            val key = chartKeyName(e) ?: return@onPreviewKeyEvent false
            var handled = false
            perform { handled = ctl.pie?.keyDown(key) ?: ctl.activePlot?.keyDown(key) ?: false }
            handled
        }
        .then(if (enabled) Modifier.focusable() else Modifier)
        // Read here, not inside the lambda: an unchanged lambda keeps its semantics node, so a value read at invocation goes stale.
        .semantics {
            if (enabled) {
                contentDescription = label; stateDescription = announcement
                fun step(key: String) = CustomAccessibilityAction(key) { perform { ctl.pie?.keyDown(chartActionKey(key, rtl)) ?: ctl.activePlot?.keyDown(chartActionKey(key, rtl)) }; true }
                customActions = if (kind == ChartKind.PIE) listOf(step("Next slice"), step("Previous slice"), step("First slice"), step("Last slice"))
                                else listOf(step("Next point"), step("Previous point"), step("First point"), step("Last point"))
            }
        }
        .pointerInput(ctl, w, h) {
            fun inside(x: Double, y: Double) = x >= 0 && y >= 0 && x <= w && y <= h
            fun move(x: Double, y: Double) {
                if (inside(x, y)) { ctl.activePlot?.pointerMove(x, y); ctl.pie?.pointerMove(x, y) }
                else if (ctl.activePlot?.dragBand != null) ctl.activePlot?.pointerMove(x, y)
            }
            awaitPointerEventScope {
                var pressed = false
                var lastTap = 0L; var lastTapPos = Offset.Zero
                while (true) {
                    val ev = awaitPointerEvent()
                    val ch = ev.changes.firstOrNull() ?: continue
                    val x = (ch.position.x / px).toDouble(); val y = (ch.position.y / px).toDouble()
                    val touch = ch.type == androidx.compose.ui.input.pointer.PointerType.Touch
                    when (ev.type) {
                        PointerEventType.Move, PointerEventType.Enter -> perform { move(x, y) }
                        PointerEventType.Exit -> if (!pressed) perform { ctl.activePlot?.pointerLeave(); ctl.pie?.pointerLeave() }
                        PointerEventType.Press -> {
                            pressed = true
                            val t = SystemClock.uptimeMillis()
                            val dbl = t - lastTap < 500 && (ch.position - lastTapPos).getDistance() <= 4 * px
                            lastTap = t; lastTapPos = ch.position
                            perform {
                                move(x, y)
                                ctl.activePlot?.pointerDown(x, y, 0); ctl.pie?.pointerDown(x, y)
                                if (dbl) ctl.activePlot?.doubleClick(x, y)
                            }
                        }
                        PointerEventType.Release -> {
                            pressed = false
                            perform {
                                ctl.activePlot?.pointerUp(x, y, inside(x, y)); if (inside(x, y)) ctl.pie?.pointerUp(x, y)
                                // Touch has no hover: a browser reports the leave right after the release.
                                if (touch) { ctl.activePlot?.pointerLeave(); ctl.pie?.pointerLeave() }
                            }
                        }
                        else -> {}
                    }
                }
            }
        }) {
        if (frame != null) {
            Canvas(Modifier.matchParentSize().clearAndSetSemantics { }) {
                val f = frame
                fun layer(a: Double, block: () -> Unit) {
                    if (a >= 1) { block(); return }
                    drawContext.canvas.saveLayer(androidx.compose.ui.geometry.Rect(0f, 0f, size.width, size.height), androidx.compose.ui.graphics.Paint().apply { alpha = a.toFloat() })
                    block(); drawContext.canvas.restore()
                }
                layer(f.alpha) { chartDrawScene(f.scene, px) }
                f.over?.let { (s, a) -> layer(a) { chartDrawScene(s, px) } }
                chartDrawBarLabels(f.scene, faces, measure, px)
                // The text overlay is synced once per render (it does not animate); glyphs and end labels ride the frame.
                val overlay = ctl.pie?.scene ?: f.scene
                val shown = if (ctl.pie == null) overlay.copy(glyphs = f.scene.glyphs, endLabels = f.scene.endLabels) else overlay
                chartDrawOverlay(shown, faces, measure, px, f.labelAlpha)
            }
            HoverLayer(ctl, version, tokens, now, tip) { tip = it }
            val band = ctl.activePlot?.dragBand; val plot = ctl.activePlot?.scene?.plot
            if (band != null && abs(band.second - band.first) > 1 && plot != null) {
                val bandColor = chartPart(AWCChartPart.ZOOM_BAND, LocalAWCChartNodeId.current).backgroundColor ?: tokens["--${kind.prefix}-zoom-band-color"]?.takeIf { it.isNotBlank() } ?: chartWithAlpha(chartToken(tokens, "--md-sys-color-primary", "#6750A4"), 0.16)
                val edge = chartCssColor(tokens["--${kind.prefix}-zoom-handle-color"]?.takeIf { it.isNotBlank() } ?: chartToken(tokens, "--md-sys-color-primary", "#6750A4"))
                Box(Modifier.awcAt(min(band.first, band.second).dp, plot.y.dp).size(abs(band.second - band.first).dp, plot.height.dp).background(chartCssColor(bandColor))) {
                    Box(Modifier.align(Alignment.CenterStart).fillMaxHeight().width(1.dp).background(edge))
                    Box(Modifier.align(Alignment.CenterEnd).fillMaxHeight().width(1.dp).background(edge))
                }
            }
        }
    }
    // The legend follows the plot as its sibling (Web: the legend buttons after the role="application" element): Tab goes
    // plot → chips, and a key on a focused chip never reaches the plot's key handler.
    LegendLayer(ctl, version, kind, tokens, measure, rtl, perform)
    if (enabled) Box(Modifier.size(1.dp).semantics { liveRegion = LiveRegionMode.Polite; if (announcement.isNotEmpty()) contentDescription = announcement })
    }
}

/** TalkBack action label → the key the Web keyboard model handles (physical arrows: the next point is on the left in RTL). */
private fun chartActionKey(action: String, rtl: Boolean) = when {
    action.startsWith("Next") -> if (rtl) "ArrowLeft" else "ArrowRight"
    action.startsWith("Previous") -> if (rtl) "ArrowRight" else "ArrowLeft"
    action.startsWith("First") -> "Home"
    else -> "End"
}

@Composable private fun HoverLayer(ctl: ChartController, version: Int, tokens: Map<String, String>, now: Double, tip: IntSize, onTip: (IntSize) -> Unit) {
    // Read `version`: the Compose compiler leaves unused parameters out of the skip check.
    @Suppress("UNUSED_VARIABLE") val changed = version
    val px = LocalDensity.current.density
    val p = ctl.activePlot; val hs = p?.hover
    val onSurface = chartCssColor(chartToken(tokens, "--md-sys-color-on-surface", "#1C1B1F"))
    val surface = chartCssColor(chartToken(tokens, "--md-sys-color-surface", "#FFFBFE"))
    val tw = tip.width / px.toDouble(); val th = tip.height / px.toDouble()
    if (p != null && hs != null) {
        val m = hs.model
        m.line?.let { l ->
            Box(Modifier.awcAt((l.x - 1).dp, (l.y - 1).dp).size((l.w + 2).dp, (l.h + 2).dp).alpha(0.7f).background(surface)) {
                Box(Modifier.offset(1.dp, 1.dp).size(l.w.dp, l.h.dp).background(onSurface))
            }
        }
        for (mk in m.markers) {
            val pop = if (mk.dimmed) 1.0 else hs.popStartMs?.let { chartPopScale(now - it) } ?: 1.0
            val color = chartCssColor(mk.color)
            val shape = mk.symbol
            if (shape != null && shape !in setOf("circle", "square", "diamond", "triangle", "triangle-down")) {
                Text(shape, Modifier.awcAt((mk.x - 11).dp, (mk.y - 11).dp).alpha(if (mk.dimmed) 0.4f else 1f).scale(pop.toFloat()))
            } else {
                val r = if (shape == null || shape == "circle") 6.5 else 5.5
                Canvas(Modifier.awcAt((mk.x - r - 2).dp, (mk.y - r - 2).dp).size(((r + 2) * 2).dp).alpha(if (mk.dimmed) 0.4f else 1f).scale(pop.toFloat())) {
                    val c = Offset(size.width / 2, size.height / 2)
                    if (shape == null || shape == "circle") { drawCircle(surface, (r * px).toFloat(), c); drawCircle(color, ((r - 2) * px).toFloat(), c) }
                    else {
                        val poly = chartMarkerPolygon(shape, (r + 2), (r + 2), r + 2) ?: emptyList()
                        val inner = chartMarkerPolygon(shape, (r + 2), (r + 2), r) ?: emptyList()
                        fun path(pts: List<ChartPt>) = androidx.compose.ui.graphics.Path().apply { pts.firstOrNull()?.let { moveTo((it.x * px).toFloat(), (it.y * px).toFloat()) }; pts.drop(1).forEach { lineTo((it.x * px).toFloat(), (it.y * px).toFloat()) }; close() }
                        drawPath(path(poly), surface); drawPath(path(inner), color)
                    }
                }
            }
        }
        if (m.customText != null || m.rows.isNotEmpty()) {
            val o = p.tooltipOrigin(tw, th, true) ?: (0.0 to 0.0)
            // md-bar-chart's card never takes the host direction (Web behaviour); line / area cards do.
            val cardDir = if (ctl.kind == ChartKind.BAR) LayoutDirection.Ltr else LocalLayoutDirection.current
            CompositionLocalProvider(LocalLayoutDirection provides cardDir) {
            TooltipCard(m, hs.scene.texts.firstOrNull()?.fontSize ?: 12.0, tokens, Modifier.awcAt(o.first.dp, o.second.dp).alpha(if (tip == IntSize.Zero) 0f else 1f).onSizeChanged(onTip))
            }
        }
    } else ctl.pie?.tooltip?.let { t ->
        val o = ctl.pie?.tooltipOrigin(tw, th) ?: (0.0 to 0.0)
        val fs = ctl.theme.labelSize
        CardBox(tokens, Modifier.awcAt(o.first.dp, o.second.dp).alpha(if (tip == IntSize.Zero) 0f else 1f).onSizeChanged(onTip)) {
            val ink = chartCssColor(chartToken(tokens, "--md-sys-color-on-surface", "#1C1B1F"))
            val d = LocalDensity.current
            if (t.customText != null) Text(t.customText!!, color = ink, fontFamily = ChartRoboto, style = TextStyle(fontSize = with(d) { fs.dp.toSp() }))
            else Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.height((fs * 1.5).dp)) {
                Box(Modifier.size(10.dp).background(chartCssColor(t.color ?: "transparent"), RoundedCornerShape(3.dp)))
                Text(t.label ?: "", color = ink, fontFamily = ChartRoboto, maxLines = 1, style = TextStyle(fontSize = with(d) { fs.dp.toSp() }))
                Text(t.value ?: "", color = ink, fontFamily = ChartRoboto, fontWeight = FontWeight.Bold, maxLines = 1, style = TextStyle(fontSize = with(d) { fs.dp.toSp() }))
            }
        }
    }
}

@Composable private fun CardBox(tokens: Map<String, String>, modifier: Modifier, content: @Composable () -> Unit) {
    val bg = chartCssColor(chartToken(tokens, "--md-sys-color-surface-container-high", "#ECE6F0"))
    Box(modifier.shadow(3.dp, RoundedCornerShape(8.dp)).background(bg, RoundedCornerShape(8.dp)).padding(horizontal = 10.dp, vertical = 8.dp).clearAndSetSemantics { }) { content() }
}

/** The tooltip card (tooltipCardCss + rows). */
@Composable private fun TooltipCard(m: ChartHoverModel, fontSize: Double, tokens: Map<String, String>, modifier: Modifier) {
    val ink = chartCssColor(chartToken(tokens, "--md-sys-color-on-surface", "#1C1B1F"))
    val d = LocalDensity.current
    val style = TextStyle(fontSize = with(d) { fontSize.dp.toSp() })
    CardBox(tokens, modifier.widthIn(min = if (m.customText == null) 96.dp else 0.dp)) {
        Column {
            if (m.customText != null) Text(m.customText!!, color = ink, fontFamily = ChartRoboto, style = style)
            else {
                Text(m.header, color = ink, fontFamily = ChartRoboto, fontWeight = FontWeight.Bold, style = style, maxLines = 1, modifier = Modifier.padding(bottom = 4.dp))
                for (r in m.rows) Row(Modifier.height((fontSize * 1.5).dp).alpha(if (r.color == null) 0.62f else 1f), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Box(Modifier.size(10.dp).background(r.color?.let { chartCssColor(it) } ?: Color.Transparent, RoundedCornerShape(if (r.color == null) 0.dp else 3.dp)))
                    Text(r.label, color = ink, fontFamily = ChartRoboto, style = style, maxLines = 1)
                    Spacer(Modifier.weight(1f, fill = false))
                    Text(r.value, color = ink, fontFamily = ChartRoboto, fontWeight = if (r.color == null) FontWeight.Normal else FontWeight.Bold, style = style, maxLines = 1)
                }
            }
        }
    }
}

@Composable private fun LegendLayer(ctl: ChartController, version: Int, kind: ChartKind, tokens: Map<String, String>, measure: ChartTextMeasurer, rtl: Boolean, perform: (() -> Unit) -> Unit) {
    @Suppress("UNUSED_VARIABLE") val changed = version   // see HoverLayer
    if (kind == ChartKind.SPARKLINE) return
    val scene = ctl.activePlot?.scene ?: ctl.pie?.scene ?: return
    val (chips, fontSize) = chartLegendLayout(scene, rtl, measure)
    val d = LocalDensity.current
    for (chip in chips) {
        val item = chip.item
        val ink = chartCssColor(if (item.hidden) chartToken(tokens, "--md-sys-color-outline", "#79747E") else chartToken(tokens, "--md-sys-color-on-surface-variant", "#49454F"))
        fun toggle() = perform {
            ctl.activePlot?.pointerLeave(); ctl.pie?.pointerLeave()
            val p = ctl.activePlot
            if (p != null) p.legendToggle(item.seriesIndex) else ctl.pie?.legendToggle(item.seriesIndex)
        }
        // A button (Web <button aria-pressed>): a Tab stop in touch mode too (an explicit focusable, as the AWC buttons),
        // Enter / Space toggle, a tap toggles.
        Row(Modifier.awcAt(chip.x.dp, chip.y.dp).size(chip.w.dp, chip.h.dp)
            .pointerInput(item.seriesIndex) { detectTapGestures { toggle() } }
            .onKeyEvent { e ->
                if (e.type == KeyEventType.KeyDown && (e.key == Key.Enter || e.key == Key.NumPadEnter || e.key == Key.Spacebar)) { toggle(); true } else false
            }
            .focusable()
            .clearAndSetSemantics {
                contentDescription = item.label; role = Role.Button; toggleableState = ToggleableState(!item.hidden)
                onClick { toggle(); true }
            }
            .padding(horizontal = 4.dp, vertical = 2.dp),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Box(Modifier.size(10.dp).alpha(if (item.hidden) 0.4f else 1f).background(chartCssColor(item.color), RoundedCornerShape(3.dp)))
            Text(item.label, color = ink, fontFamily = ChartRoboto, maxLines = 1, overflow = TextOverflow.Ellipsis,
                style = TextStyle(fontSize = with(d) { fontSize.dp.toSp() }, textDecoration = if (item.hidden) TextDecoration.LineThrough else null))
        }
    }
}

/** The md-slider range the Web chart embeds as its zoom slider, with the pan grip over its window. */
@Composable private fun ChartZoomSlider(ctl: ChartController, version: Int, tokens: Map<String, String>, prefix: String, rtl: Boolean, pr: ChartProps, perform: (() -> Unit) -> Unit, modifier: Modifier,
                                         parts: Map<AWCChartPart, AWCTablePartStyle> = emptyMap()) {
    @Suppress("UNUSED_VARIABLE") val changed = version   // see HoverLayer
    val p = ctl.activePlot ?: return
    val px = LocalDensity.current.density
    fun tok(k: String, sys: String, fallback: String) = tokens["--$prefix-zoom-$k"]?.takeIf { it.isNotBlank() } ?: chartToken(tokens, sys, fallback)
    val last = max(1, p.dataLength() - 1).toDouble()
    val win = p.win()
    val xData = awcList(awcMap(pr.obj("xAxis"))["data"])
    fun text(i: Int) = xData.getOrNull(i)?.let { chartJsString(it) } ?: i.toString()
    BoxWithConstraints(modifier) {
        val width = maxWidth.value.toDouble()
        val mh = maxHeight
        fun x(i: Int): Double { val f = i / last; return (if (rtl) 1 - f else f) * width }
        fun frac(px0: Double): Double { val raw = px0 / max(1.0, width); return min(max(if (rtl) 1 - raw else raw, 0.0), 1.0) }
        val lo = min(x(win.first), x(win.second)); val hi = max(x(win.first), x(win.second))
        // ::part(zoom-slider) (track, window, thumbs): its opacity is the slider's alone; ::part(zoom-pan) is its sibling above it.
        Box(Modifier.matchParentSize().then(parts[AWCChartPart.ZOOM_SLIDER]?.opacity?.let { Modifier.alpha(it.toFloat()) } ?: Modifier)) {
        Box(Modifier.align(Alignment.CenterStart).fillMaxWidth().height(12.dp).background(chartCssColor(parts[AWCChartPart.ZOOM_TRACK]?.backgroundColor ?: tok("track-color", "--md-sys-color-surface-container-highest", "#E6E0E9")), CircleShape))
        Box(Modifier.align(AbsoluteAlignment.CenterLeft).absoluteOffset(lo.dp).width(max(0.0, hi - lo).dp).height(12.dp).background(chartCssColor(parts[AWCChartPart.ZOOM_WINDOW]?.backgroundColor ?: tok("window-color", "--md-sys-color-secondary-container", "#E8DEF8")), CircleShape)
            .pointerInput(win) {
                awaitEachGesture {
                    val down = awaitFirstDown()
                    perform { p.panStart(frac(lo + down.position.x / px)) }
                    while (true) {
                        val ev = awaitPointerEvent(); val ch = ev.changes.firstOrNull { it.id == down.id } ?: break
                        if (!ch.pressed) break
                        ch.consume(); perform { p.panMove(frac(lo + ch.position.x / px)) }
                    }
                    perform { p.panEnd() }
                }
            })
        val handle = chartCssColor(parts[AWCChartPart.ZOOM_HANDLE]?.backgroundColor ?: tok("handle-color", "--md-sys-color-primary", "#6750A4"))
        for (isStart in listOf(true, false)) {
            val idx = if (isStart) win.first else win.second
            val label = if (isStart) pr.str("labelZoomStart", "Zoom range start") else pr.str("labelZoomEnd", "Zoom range end")
            Box(Modifier.align(AbsoluteAlignment.CenterLeft).absoluteOffset((x(idx) - 10).dp).size(20.dp, mh)
                .pointerInput(win, isStart) {
                    awaitEachGesture {
                        val down = awaitFirstDown()
                        while (true) {
                            val ev = awaitPointerEvent(); val ch = ev.changes.firstOrNull { it.id == down.id } ?: break
                            if (!ch.pressed) break
                            ch.consume()
                            val v = jsRound(frac(x(idx) - 10 + ch.position.x / px) * last)
                            perform { if (isStart) p.zoomSliderInput(v, win.second.toDouble()) else p.zoomSliderInput(win.first.toDouble(), v) }
                        }
                    }
                }
                .semantics {
                    contentDescription = label; stateDescription = text(idx)
                    progressBarRangeInfo = ProgressBarRangeInfo(idx.toFloat(), 0f..last.toFloat(), max(0, last.toInt() - 1))
                    setProgress { target -> perform { val v = jsRound(target.toDouble()); if (isStart) p.zoomSliderInput(v, win.second.toDouble()) else p.zoomSliderInput(win.first.toDouble(), v) }; true }
                }, contentAlignment = Alignment.Center) {
                Box(Modifier.size(4.dp, mh).background(handle, CircleShape))
            }
        }
        }
        // ::part(zoom-pan): the pan grip between the thumbs (inset 10 at both ends), above the slider (z-index 1).
        parts[AWCChartPart.ZOOM_PAN]?.backgroundColor?.let { bg -> Box(Modifier.align(AbsoluteAlignment.CenterLeft).absoluteOffset((lo + 10).dp).size(max(0.0, hi - lo - 20).dp, mh).background(chartCssColor(bg))) }
    }
}
