package dev.awc.nativeui

import android.os.SystemClock
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.focusable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.RoundRect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.input.key.*
import androidx.compose.ui.input.pointer.PointerType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.layout
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.layout.layoutId
import androidx.compose.ui.unit.Constraints
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.LocalTextStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import dev.awc.nativeui.slider.SrPaintMeasurer
import dev.awc.nativeui.slider.srCssColor
import dev.awc.nativeui.slider.srJsNumberString
import dev.awc.nativeui.slider.*
import kotlin.math.max
import kotlin.math.min

// Dedicated Compose renderer for md-slider: SliderInteraction (the component + its native range inputs) drives values,
// events and focus; SliderLayout gives every painted box as Chrome lays it out (1 CSS px = 1 dp); SliderMotion runs
// the stylesheet's transitions (knob press morph, the stops spring, stop fades).

private val SliderRoboto = FontFamily(Font(R.font.awc_roboto_regular, FontWeight.Normal), Font(R.font.awc_roboto_medium, FontWeight.Medium), Font(R.font.awc_roboto_bold, FontWeight.Bold))
private val SliderSymbols = FontFamily(Font(R.font.awc_material_symbols))

@Composable internal fun rememberAWCSrPaintMeasurer(): SrPaintMeasurer {
    val context = LocalContext.current
    return remember(context) {
        fun face(id: Int) = context.resources.getFont(id)
        SrPaintMeasurer(face(R.font.awc_roboto_regular), face(R.font.awc_roboto_medium), face(R.font.awc_roboto_bold))
    }
}

/**
 * Places the content at the physical (x, y) of its parent box in either layout direction. The layout models already
 * return mirrored (physical) coordinates for RTL; `offset` would mirror x again (and a Box child starts at the top-right
 * corner in RTL), so positioned parts fill the parent and place their content with `place`, which never mirrors.
 */
internal fun Modifier.awcSrAt(x: Dp, y: Dp): Modifier = layout { measurable, constraints ->
    val p = measurable.measure(constraints.copy(minWidth = 0, minHeight = 0))
    val px = x.roundToPx(); val py = y.roundToPx()
    val w = if (constraints.hasBoundedWidth) constraints.maxWidth else px + p.width
    val h = if (constraints.hasBoundedHeight) constraints.maxHeight else py + p.height
    layout(w, h) { p.place(px, py) }
}

/** Centres the content on the physical point (x, y) of its parent box (CSS `translate(-50%, -50%)` from that point). */
internal fun Modifier.awcSrCenterAt(x: Dp, y: Dp): Modifier = layout { measurable, constraints ->
    val p = measurable.measure(constraints.copy(minWidth = 0, minHeight = 0))
    val w = if (constraints.hasBoundedWidth) constraints.maxWidth else p.width
    val h = if (constraints.hasBoundedHeight) constraints.maxHeight else p.height
    layout(w, h) { p.place(x.roundToPx() - p.width / 2, y.roundToPx() - p.height / 2) }
}

/** The CSS custom properties (`--md-<tag>-*`) from the theme tokens, overridden by the host's inline `style`. */
internal fun awcSrComponentHooks(prefix: String, tokens: Map<String, String>, style: String): Map<String, String> {
    val out = HashMap<String, String>()
    for ((k, v) in tokens) if (k.startsWith(prefix)) out[k.removePrefix(prefix)] = v
    for (part in style.split(';')) { val i = part.indexOf(':'); if (i > 0) { val k = part.substring(0, i).trim(); if (k.startsWith(prefix)) out[k.removePrefix(prefix)] = part.substring(i + 1).trim() } }
    return out
}
internal fun awcSrPx(v: String?): Double? = v?.trim()?.removeSuffix("px")?.toDoubleOrNull()
internal fun awcSrTokenNumber(tokens: Map<String, String>, name: String, fallback: Double) = tokens[name]?.trim()?.removeSuffix("px")?.removeSuffix("ms")?.toDoubleOrNull() ?: fallback

/** Frame clock for a view-local transition set: re-reads `now` every frame while `active` says so. */
@Composable internal fun awcSrMotionClock(active: () -> Boolean, version: Int): Double {
    var now by remember { mutableDoubleStateOf(SystemClock.uptimeMillis().toDouble()) }
    LaunchedEffect(version) {
        now = SystemClock.uptimeMillis().toDouble()
        while (active()) { withFrameMillis { now = SystemClock.uptimeMillis().toDouble() } }
        now = SystemClock.uptimeMillis().toDouble()
    }
    return now
}

private fun sliderKey(e: KeyEvent): String? = when (e.key) {
    Key.DirectionLeft -> "ArrowLeft"; Key.DirectionRight -> "ArrowRight"; Key.DirectionUp -> "ArrowUp"; Key.DirectionDown -> "ArrowDown"
    Key.MoveHome -> "Home"; Key.MoveEnd -> "End"; Key.PageUp -> "PageUp"; Key.PageDown -> "PageDown"; else -> null
}

/** The default inset glyph's layout id (anything else in the inset box is the inset-icon slot's content). */
private object SliderInsetGlyph

@Composable internal fun NativeSliderView(p: Props, emit: EventSink, content: Slot? = null) {
    // Theme tokens, then the typed hooks (AWCSliderAppearanceScope), then the host's inline `style` custom properties.
    val sliderParts = LocalAWCSliderParts.current
    val tokens = awcSrEffectiveTokens(LocalAWCThemeTokens.current, LocalAWCSliderAppearance.current.hooks, p.str("style"))
    val density = LocalAWCNativeDensity.current
    val rtlEnv = LocalLayoutDirection.current == LayoutDirection.Rtl
    val (reduced, _) = rememberAWCAccessibilityAppearance()
    val s = remember { SliderInteraction() }
    val motion = remember { SliderMotion() }
    var version by remember { mutableIntStateOf(0) }
    val measurer = rememberAWCSrPaintMeasurer()
    fun perform(block: () -> Unit) { block(); s.render(); version++ }

    // Host properties → the interaction, once per composition (the interaction runs Stencil's watchers on changes only;
    // the component's own value writes live in the interaction — Compose hosts own their props).
    motion.reducedMotion = reduced
    s.onEvent = { e -> emit(e.name, e.detail) }
    s.sync(SliderProps(p.srDouble("min"), p.srDouble("max", 100.0), p.srDouble("step", 1.0), p.srDouble("value", 50.0),
        p.srDouble("valueStart", 0.0), p.srDouble("valueEnd", 100.0), p.bool("disabled"), p.str("variant", "standard"), p.bool("range"),
        p.bool("stops"), p.str("size", "xs"), p.str("orientation", "horizontal"), p.bool("valueIndicator"), p.bool("labeled"), p.bool("insetIcon"),
        p.bool("controlled"), p.str("dir") == "rtl" || (p.str("dir") != "ltr" && rtlEnv)))

    fun c(n: String, f: String) = tokens["--md-sys-color-$n"]?.takeIf { it.isNotBlank() } ?: f
    val theme = SliderTheme(c("primary", "#6750A4"), c("on-primary", "#FFFFFF"), c("secondary", "#625B71"), c("secondary-container", "#E8DEF8"),
        c("on-secondary-container", "#1E192B"), c("inverse-surface", "#313033"), c("inverse-on-surface", "#F4EFF4"), c("surface", "#FFFBFE"), c("on-surface", "#1C1B1F"),
        densityScale = density, spacingInsetMd = awcSrTokenNumber(tokens, "--md-sys-spacing-inset-md", 12.0), spacingInsetLg = awcSrTokenNumber(tokens, "--md-sys-spacing-inset-lg", 16.0),
        disabledContentOpacity = awcSrTokenNumber(tokens, "--md-sys-state-disabled-content-opacity", 0.38),
        disabledContainerOpacity = awcSrTokenNumber(tokens, "--md-sys-state-disabled-container-opacity", 0.12),
        labelLineHeight = awcSrTokenNumber(tokens, "--md-sys-typescale-label-medium-line-height", 16.0),
        labelLetterSpacing = awcSrTokenNumber(tokens, "--md-sys-typescale-label-medium-letter-spacing", 0.5))
    val hk = awcSrComponentHooks("--md-slider-", tokens, p.str("style"))
    val hooks = SliderHooks(activeColor = hk["active-color"], inactiveColor = hk["inactive-color"], tickActiveColor = hk["tick-active-color"],
        tickFilledColor = hk["tick-filled-color"], tickInactiveColor = hk["tick-inactive-color"], thumbColor = hk["thumb-color"],
        thumbWidth = awcSrPx(hk["thumb-width"]), thumbHeight = awcSrPx(hk["thumb-height"]), trackHeight = awcSrPx(hk["track-height"]), trackShape = awcSrPx(hk["track-shape"]),
        trackLength = awcSrPx(hk["track-length"]), minTrackLength = awcSrPx(hk["min-track-length"]), valueBg = hk["value-bg"], valueColor = hk["value-color"],
        valueShape = awcSrPx(hk["value-shape"]), valueFontSize = awcSrPx(hk["value-font-size"]), valueFontWeight = hk["value-font-weight"]?.toDoubleOrNull(),
        valueLineHeight = awcSrPx(hk["value-line-height"]), valuePaddingInline = awcSrPx(hk["value-padding-inline"]), valuePaddingBlock = awcSrPx(hk["value-padding-block"]),
        insetIconColor = hk["inset-icon-color"], insetIconActiveColor = hk["inset-icon-active-color"], valueIndicatorReserve = awcSrPx(hk["value-indicator-reserve"]))
    val fullHeight = p.bool("fullHeight")
    val densityProp = (p["density"] as? Number)?.toInt() ?: p.str("density").toIntOrNull()
    val now = awcSrMotionClock({ motion.active(SystemClock.uptimeMillis().toDouble()) }, version)

    BoxWithConstraints(Modifier.fillMaxWidth()) {
        val fill = !s.vertical || !fullHeight
        val cw = if (s.vertical && !fill) 0.0 else maxWidth.value.toDouble()
        val ch = if (constraints.hasBoundedHeight) maxHeight.value.toDouble() else null
        @Suppress("UNUSED_VARIABLE") val v = version
        val paint = SliderParts.applied(SliderLayout.layout(s, theme, SliderParts.hooks(hooks, sliderParts), measurer, cw, ch, fullHeight, densityProp, motion, now), sliderParts, s.vertical)
        SliderSurface(paint, s, p, ::perform, content)
    }
}

@Composable private fun SliderSurface(paint: SliderPaint, s: SliderInteraction, p: Props, perform: (() -> Unit) -> Unit, content: Slot? = null) {
    val px = LocalDensity.current.density
    var dragging by remember { mutableStateOf(false) }
    Box(Modifier.size(paint.width.dp, paint.height.dp).alpha(paint.opacity.toFloat())
        .inspectAWCNode(LocalAWCInspection.current, "", "md-slider", AWCInspectionMetrics(display = "Compose Box", direction = if (s.rtl) "rtl" else "ltr"))
        .pointerInput(paint.rail, s.disabled) {
            if (s.disabled) return@pointerInput
            awaitEachGesture {
                val down = awaitFirstDown()
                fun local(o: Offset) = (o.x / px - paint.rail.x) to (o.y / px - paint.rail.y)
                val (x0, y0) = local(down.position)
                val touch = down.type == PointerType.Touch
                perform { dragging = true; s.pointerMove(x0, y0, paint.rail.width, paint.rail.height); s.pointerDown(x0, y0, paint.rail.width, paint.rail.height, touch) }
                var last = down.position
                while (true) {
                    val ev = awaitPointerEvent()
                    val ch = ev.changes.firstOrNull { it.id == down.id } ?: break
                    last = ch.position
                    if (!ch.pressed) break
                    val (x, y) = local(ch.position); ch.consume()
                    perform { s.pointerMove(x, y, paint.rail.width, paint.rail.height) }
                }
                val (x1, y1) = local(last)
                perform { dragging = false; s.pointerUp(x1, y1, paint.rail.width, paint.rail.height) }
            }
        }) {
        Canvas(Modifier.matchParentSize()) {
            val tr = paint.track
            val clip = Path().apply { addRoundRect(RoundRect((tr.x * px).toFloat(), (tr.y * px).toFloat(), ((tr.x + tr.width) * px).toFloat(), ((tr.y + tr.height) * px).toFloat(),
                CornerRadius((min(paint.trackRadius, min(tr.width, tr.height) / 2) * px).toFloat()))) }
            clipPath(clip) {
                for (seg in paint.segments) if (seg.rect.width > 0 && seg.rect.height > 0) {
                    val r = seg.rect; val k = seg.radii
                    val f = min(1.0, min(r.width / max(1e-9, max(k.tl + k.tr, k.bl + k.br)), r.height / max(1e-9, max(k.tl + k.bl, k.tr + k.br))))
                    fun cr(v: Double) = CornerRadius((v * f * px).toFloat())
                    drawPath(Path().apply { addRoundRect(RoundRect((r.x * px).toFloat(), (r.y * px).toFloat(), ((r.x + r.width) * px).toFloat(), ((r.y + r.height) * px).toFloat(),
                        cr(k.tl), cr(k.tr), cr(k.br), cr(k.bl))) }, srCssColorOf(seg.color))
                }
                for (t in paint.ticks) if (t.opacity > 0) {
                    val r = t.rect
                    drawOval(srCssColorOf(t.color), Offset((r.x * px).toFloat(), (r.y * px).toFloat()), Size((r.width * px).toFloat(), (r.height * px).toFloat()), alpha = t.opacity.toFloat())
                }
            }
            for (t in paint.thumbs) {
                val k = t.knob
                drawRoundRect(srCssColorOf(t.knobColor), Offset((k.x * px).toFloat(), (k.y * px).toFloat()), Size((k.width * px).toFloat(), (k.height * px).toFloat()),
                    CornerRadius((min(k.width, k.height) / 2 * px).toFloat()))
                if (t.focusRing) {
                    val o = 3.5
                    drawRoundRect(srCssColorOf(paint.focusRingColor), Offset(((k.x - o) * px).toFloat(), ((k.y - o) * px).toFloat()),
                        Size(((k.width + 2 * o) * px).toFloat(), ((k.height + 2 * o) * px).toFloat()),
                        CornerRadius((min(k.width + 2 * o, k.height + 2 * o) / 2 * px).toFloat()), style = Stroke((3 * px).toFloat()))
                }
            }
        }
        paint.inset?.let { inset ->
            // R6-04: content in the inset-icon slot replaces the glyph (::slotted: centred in the inset box, inset-size font, the
            // inset colour inherited); with nothing slotted the icon glyph shows.
            val d = LocalDensity.current
            val ink = srCssColorOf(inset.color)
            Layout(content = {
                if (content != null) CompositionLocalProvider(LocalContentColor provides ink,
                    LocalTextStyle provides TextStyle(color = ink, fontSize = with(d) { inset.size.dp.toSp() })) { content("inset-icon") }
                Box(Modifier.layoutId(SliderInsetGlyph)) {
                    Text(p.str("icon", "volume_up"), color = ink, fontFamily = SliderSymbols,
                        style = TextStyle(fontSize = with(d) { inset.size.dp.toSp() }, lineHeight = with(d) { inset.size.dp.toSp() }))
                }
            }, modifier = Modifier.awcSrAt(inset.rect.x.dp, inset.rect.y.dp).size(inset.rect.width.dp, inset.rect.height.dp).clearAndSetSemantics { }) { ms, c ->
                val slotted = ms.filter { it.layoutId !== SliderInsetGlyph }
                val shown = slotted.ifEmpty { ms.filter { it.layoutId === SliderInsetGlyph } }
                val pls = shown.map { it.measure(Constraints(maxWidth = c.maxWidth, maxHeight = c.maxHeight)) }
                layout(c.maxWidth, c.maxHeight) { pls.forEach { it.place((c.maxWidth - it.width) / 2, (c.maxHeight - it.height) / 2) } }
            }
        }
        for (ind in paint.indicators) {
            val radius = min(ind.radius, min(ind.rect.width, ind.rect.height) / 2)
            Box(Modifier.awcSrAt(ind.rect.x.dp, ind.rect.y.dp).size(ind.rect.width.dp, ind.rect.height.dp)
                .background(srCssColorOf(ind.background), RoundedCornerShape(radius.dp)), contentAlignment = Alignment.Center) {
                val d = LocalDensity.current
                Text(ind.text, color = srCssColorOf(ind.color), fontFamily = SliderRoboto, fontWeight = FontWeight(ind.fontWeight.toInt()), maxLines = 1, softWrap = false,
                    style = TextStyle(fontSize = with(d) { ind.fontSize.dp.toSp() }, lineHeight = with(d) { ind.lineHeight.dp.toSp() }, letterSpacing = with(d) { ind.letterSpacing.dp.toSp() }))
            }
        }
        for (t in paint.thumbs) SliderThumbInput(t, paint, s, p, perform)
    }
}

/** Each thumb is a focusable, adjustable node (the Web's per-thumb native range input). */
@Composable private fun SliderThumbInput(t: SliderThumbPaint, paint: SliderPaint, s: SliderInteraction, p: Props, perform: (() -> Unit) -> Unit) {
    val hit = max(48.0, if (s.vertical) t.box.height else t.box.width)
    val w = if (s.vertical) t.box.width else hit; val h = if (s.vertical) hit else max(48.0, t.box.height)
    val value = when (t.thumb) { "start" -> s.displayStart; "end" -> s.displayEnd; else -> s.displayValue }
    val base = p.str("sliderAriaLabel", p.str("ariaLabel"))
    val label = when (t.thumb) { "start" -> p.str("ariaLabelStart", p.str("labelStart", base.ifEmpty { "range start" })); "end" -> p.str("ariaLabelEnd", p.str("labelEnd", base.ifEmpty { "range end" })); else -> base.ifEmpty { "slider" } }
    val valueText = when (t.thumb) { "start" -> p.str("valueStartText"); "end" -> p.str("valueEndText"); else -> p.str("valueText") }.ifEmpty { srJsNumberString(value) }
    val lo = s.min; val hi = s.max; val off = s.disabled
    Box(Modifier.awcSrAt((t.box.x + t.box.width / 2 - w / 2).dp, (t.box.y + t.box.height / 2 - h / 2).dp).size(w.dp, h.dp)
        .onFocusChanged { f -> perform { if (f.isFocused) { if (s.focusedThumb != t.thumb) s.focus(t.thumb, keyboard = true) } else if (s.focusedThumb == t.thumb) s.blur() } }
        .onPreviewKeyEvent { e ->
            val key = sliderKey(e) ?: return@onPreviewKeyEvent false
            when (e.type) { KeyEventType.KeyDown -> perform { s.keyDown(t.thumb, key) }; KeyEventType.KeyUp -> perform { s.keyUp(t.thumb, key) }; else -> return@onPreviewKeyEvent false }
            true
        }
        .focusable(!s.disabled)
        // The block captures the values it exposes (a memoized lambda reading `s` would keep stale semantics).
        .semantics {
            contentDescription = label
            stateDescription = valueText
            progressBarRangeInfo = ProgressBarRangeInfo(value.toFloat(), lo.toFloat()..hi.toFloat(), 0)
            if (off) disabled()
            // Defined while disabled too (a SeekBar, as Web keeps role=slider); it adjusts an enabled thumb only.
            setProgress { target -> if (off) false else { perform { s.key(t.thumb, if (target > value) "ArrowUp" else "ArrowDown") }; true } }
        })
}

internal fun srCssColorOf(c: dev.awc.nativeui.slider.SrRgba) =
    androidx.compose.ui.graphics.Color(c.r.toFloat().coerceIn(0f, 1f), c.g.toFloat().coerceIn(0f, 1f), c.b.toFloat().coerceIn(0f, 1f), c.a.toFloat().coerceIn(0f, 1f))
