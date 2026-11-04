@file:OptIn(androidx.compose.ui.text.ExperimentalTextApi::class)
package dev.awc.nativeui

import android.os.SystemClock
import androidx.compose.foundation.border
import androidx.compose.foundation.focusable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.draw.scale
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.ClipOp
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.ui.input.key.*
import androidx.compose.ui.input.pointer.PointerEventType
import androidx.compose.ui.input.pointer.PointerType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.PlatformTextStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.*
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import dev.awc.nativeui.rating.*
import dev.awc.nativeui.slider.SliderMotion
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

// Dedicated Compose renderer for md-rating: RatingInteraction (hover preview, click / reset, keyboard, the readonly /
// disabled / soft-disabled gates) drives the value and events; RatingLayout gives the row, item boxes, the clipped
// glyph layers, the value label and the focus ring as Chrome lays them out; SliderMotion runs the hover pop and
// state-layer transitions; a press starts the glyph-clipped ripple (420 ms).

private val RatingRoboto = FontFamily(Font(R.font.awc_roboto_regular, FontWeight.Normal), Font(R.font.awc_roboto_medium, FontWeight.Medium))

@Composable private fun RatingGlyph(name: String, size: Double, fill: Float, weight: Int, color: androidx.compose.ui.graphics.Color, modifier: Modifier = Modifier) {
    val family = remember(fill, weight) {
        FontFamily(Font(R.font.awc_material_symbols, FontWeight(weight), variationSettings = FontVariation.Settings(
            FontVariation.Setting("FILL", fill), FontVariation.weight(weight), FontVariation.Setting("opsz", 24f), FontVariation.grade(0))))
    }
    val fs = with(LocalDensity.current) { size.dp.toSp() }
    Box(modifier.size(size.dp), contentAlignment = Alignment.Center) {
        Text(name, Modifier.wrapContentSize(unbounded = true), color = color, fontFamily = family, fontWeight = FontWeight(weight), fontSize = fs, lineHeight = fs,
            letterSpacing = 0.sp, maxLines = 1, softWrap = false, style = TextStyle(platformStyle = PlatformTextStyle(includeFontPadding = false), fontFeatureSettings = "liga"))
    }
}

private fun ratingKey(e: KeyEvent): String? = when (e.key) {
    Key.DirectionLeft -> "ArrowLeft"; Key.DirectionRight -> "ArrowRight"; Key.DirectionUp -> "ArrowUp"; Key.DirectionDown -> "ArrowDown"
    Key.MoveHome -> "Home"; Key.MoveEnd -> "End"
    else -> e.utf16CodePoint.takeIf { it in '0'.code..'9'.code }?.toChar()?.toString()
}

@Composable internal fun NativeRatingView(p: Props, emit: EventSink) {
    // Theme tokens, then the typed hooks (AWCRatingAppearanceScope), then the host's inline `style` custom properties.
    val tokens = awcSrEffectiveTokens(LocalAWCThemeTokens.current, LocalAWCRatingAppearance.current.hooks, p.str("style"))
    val focusRequester = remember { FocusRequester() }
    val publicController = LocalAWCRatingController.current
    DisposableEffect(publicController) {
        publicController?.focus = { runCatching { focusRequester.requestFocus() } }
        onDispose { publicController?.focus = null }
    }
    val density = LocalAWCNativeDensity.current
    val rtlEnv = LocalLayoutDirection.current == LayoutDirection.Rtl
    val (reduced, _) = rememberAWCAccessibilityAppearance()
    val r = remember { RatingInteraction() }
    val motion = remember { SliderMotion() }
    val ripples = remember { mutableStateListOf<RatingRipple>() }
    var hoverItem by remember { mutableIntStateOf(-1) }
    var pressedItem by remember { mutableIntStateOf(-1) }
    // The last tapped item keeps its hover look (Chrome's emulated :hover after a tap) until focus leaves or a pointer hovers.
    var stickyItem by remember { mutableIntStateOf(-1) }
    val tapScope = rememberCoroutineScope()
    var version by remember { mutableIntStateOf(0) }
    val measurer = rememberAWCSrPaintMeasurer()
    fun perform(block: () -> Unit) { block(); version++ }

    // Host properties → the interaction, once per composition (Stencil's watchers on changes only; the component's own
    // value writes live in the interaction — Compose hosts own their props).
    r.sync(RatingProps(p.num("value").toDouble(), p.num("defaultValue").toDouble(), p.int("max", 5).coerceIn(1, 100), p.num("precision", 1f).toDouble(),
        p.bool("readonly"), p.bool("disabled"), p.bool("softDisabled"), p.str("hover", "preview"), p.str("dir") == "rtl" || (p.str("dir") != "ltr" && rtlEnv)))
    r.onEvent = { e -> emit(e.name, e.detail) }
    motion.reducedMotion = reduced

    fun c(n: String, f: String) = tokens["--md-sys-color-$n"]?.takeIf { it.isNotBlank() } ?: f
    val theme = RatingTheme(c("secondary", "#625B71"), c("on-surface", "#1C1B1F"), c("on-surface-variant", "#49454F"), densityScale = density,
        gapXs = awcSrTokenNumber(tokens, "--md-sys-spacing-gap-xs", 4.0), gapMd = awcSrTokenNumber(tokens, "--md-sys-spacing-gap-md", 12.0),
        labelLineHeight = awcSrTokenNumber(tokens, "--md-sys-typescale-label-medium-line-height", 16.0),
        disabledContentOpacity = awcSrTokenNumber(tokens, "--md-sys-state-disabled-content-opacity", 0.38),
        hoverOpacity = awcSrTokenNumber(tokens, "--md-sys-state-hover-state-layer-opacity", 0.08),
        pressedOpacity = awcSrTokenNumber(tokens, "--md-sys-state-pressed-state-layer-opacity", 0.12),
        durationShort3Ms = awcSrTokenNumber(tokens, "--md-sys-motion-duration-short3", 150.0),
        rippleEnabled = tokens["--md-sys-ripple-enabled"]?.trim() != "0")
    val hk = awcSrComponentHooks("--md-rating-", tokens, p.str("style"))
    val font = hk["value-label-font"]?.let { Regex("""/(\d+(?:\.\d+)?)px\s+(.+)$""").find(it) }
    val hooks = RatingHooks(itemSize = awcSrPx(hk["item-size"]), itemGap = awcSrPx(hk["item-gap"]), activeColor = hk["active-color"], inactiveColor = hk["inactive-color"],
        focusRingColor = hk["focus-ring-color"], focusRingWidth = awcSrPx(hk["focus-ring-width"]), focusRingOffset = awcSrPx(hk["focus-ring-offset"]),
        stateLayerColor = hk["state-layer-color"], valueLabelColor = hk["value-label-color"],
        valueLabelFontFamily = font?.groupValues?.get(2), valueLabelLineHeight = font?.groupValues?.get(1)?.toDoubleOrNull(),
        popScale = hk["pop-scale"]?.toDoubleOrNull(), durationMs = hk["duration"]?.removeSuffix("ms")?.toDoubleOrNull())
    val now = awcSrMotionClock({ val t = SystemClock.uptimeMillis().toDouble(); motion.active(t) || ripples.any { t < it.start + 420 } }, version)
    @Suppress("UNUSED_VARIABLE") val v = version
    val paint = RatingLayout.layout(r, theme, hooks, measurer, p.str("size", "md"), p.str("icon", "star"), p.str("emptyIcon", "star"),
        p.bool("outlineEmpty", true), p.bool("showValueLabel"), (p["density"] as? Number)?.toInt() ?: p.str("density").toIntOrNull(),
        if (r.disabled) -1 else if (hoverItem >= 0) hoverItem else stickyItem, if (r.disabled) -1 else pressedItem, ripples.toList(), reduced, motion, now)
    val ratingLabel = p.str("ratingLabel", p.str("ariaLabel", "Rating"))
    val aValue = r.value; val aText = r.label(r.value); val aMax = r.max; val aReadonly = r.readonly; val aInteractive = r.isInteractive
    val aDisabled = r.disabled || r.softDisabled

    Box(Modifier.size(paint.width.dp, paint.height.dp).alpha(paint.opacity.toFloat())
        .onFocusChanged { f -> perform { if (f.isFocused) { if (!r.focused) r.focus(keyboard = true) } else { r.blur(); stickyItem = -1 } } }
        .onPreviewKeyEvent { e ->
            if (e.type != KeyEventType.KeyDown) return@onPreviewKeyEvent false
            val key = ratingKey(e) ?: return@onPreviewKeyEvent false
            var handled = false; perform { handled = r.keyDown(key) }; handled
        }
        .focusRequester(focusRequester)
        .focusable(r.focusable)
        .inspectAWCNode(LocalAWCInspection.current, "", "md-rating", AWCInspectionMetrics(display = "Compose Box", direction = if (r.rtl) "rtl" else "ltr"))
        // One node, as the Web host (role=slider; readonly role=img): the glyph ligatures ("star") stay out of its name.
        // The block captures the values it exposes (a memoized lambda reading `r` would keep stale semantics).
        .clearAndSetSemantics {
            if (aReadonly) { contentDescription = "$ratingLabel: $aText"; role = Role.Image }
            else {
                contentDescription = ratingLabel; stateDescription = aText
                progressBarRangeInfo = ProgressBarRangeInfo(aValue.toFloat(), 0f..aMax.toFloat(), 0)
                // Defined while disabled too (a SeekBar, as Web keeps role=slider); it adjusts an interactive rating only.
                setProgress { target -> if (!aInteractive) false else { perform { r.setFromAssistive(target.toDouble()) }; true } }
            }
            if (aDisabled) disabled()
        }) {
        for (it in paint.itemList) RatingItemView(it, paint, r, onHover = { i, fx -> perform { hoverItem = i; stickyItem = -1; if (i < 0) r.pointerLeave() else r.pointerMove(i, fx) } },
            onPress = { i, fx, fy -> perform {
                hoverItem = i; pressedItem = i; r.pointerMove(i, fx); r.pointerDown()
                val t = SystemClock.uptimeMillis().toDouble()
                ripples.removeAll { it.start + 1420 < t }; ripples.add(RatingRipple(i, t, fx * 100, fy * 100))
            } },
            onRelease = { i, fx -> perform { pressedItem = -1; r.pointerMove(i, fx); r.click(i, fx) } },
            // A finger (Chrome): pointerdown runs the ripple only; the tap focuses without a ring, clicks, and keeps the item's hover look.
            onTouchPress = { i, fx, fy -> perform {
                val t = SystemClock.uptimeMillis().toDouble()
                ripples.removeAll { it.start + 1420 < t }; ripples.add(RatingRipple(i, t, fx * 100, fy * 100))
            } },
            onTouchRelease = { i, fx ->
                perform { stickyItem = i; pressedItem = i; r.tap(i, fx) }; if (r.focusable) runCatching { focusRequester.requestFocus() }
                // Chrome holds :active 150 ms after the tap's synthesized mousedown (kMinimumActiveInterval).
                tapScope.launch { delay(150); if (pressedItem == i) perform { pressedItem = -1 } }
            })
        val label = paint.label; val text = paint.labelText
        if (label != null && text != null) {
            val d = LocalDensity.current
            Text(text, Modifier.awcSrAt(label.x.dp, label.y.dp).width(label.width.dp).clearAndSetSemantics { }, color = srCssColorOf(paint.labelColor), fontFamily = RatingRoboto,
                fontWeight = FontWeight(paint.labelFontWeight.toInt()), maxLines = 1, softWrap = false,
                style = TextStyle(fontSize = with(d) { paint.labelFontSize.dp.toSp() }, lineHeight = with(d) { paint.labelLineHeight.dp.toSp() }, fontFeatureSettings = "tnum"))
        }
        if (paint.focusRing) {
            val o = paint.focusRingOffset + paint.focusRingWidth
            Box(Modifier.awcSrAt((paint.items.x - o).dp, (paint.items.y - o).dp).size((paint.items.width + 2 * o).dp, (paint.items.height + 2 * o).dp)
                .border(paint.focusRingWidth.dp, srCssColorOf(paint.focusRingColor), RoundedCornerShape(50)))
        }
    }
}

@Composable private fun RatingItemView(it: RatingItemPaint, paint: RatingPaint, r: RatingInteraction,
                                      onHover: (Int, Double) -> Unit, onPress: (Int, Double, Double) -> Unit, onRelease: (Int, Double) -> Unit,
                                      onTouchPress: (Int, Double, Double) -> Unit, onTouchRelease: (Int, Double) -> Unit) {
    val size = paint.glyphSize
    val px = LocalDensity.current.density
    Box(Modifier.awcSrAt(it.rect.x.dp, it.rect.y.dp).size(it.rect.width.dp, it.rect.height.dp).scale(it.scale.toFloat())
        .pointerInput(it.index, r.disabled, r.softDisabled) {
            if (r.disabled || r.softDisabled) return@pointerInput
            awaitPointerEventScope {
                while (true) {
                    val ev = awaitPointerEvent()
                    val ch = ev.changes.firstOrNull() ?: continue
                    val fx = (ch.position.x / (it.rect.width * px)).toDouble().coerceIn(0.0, 1.0)
                    val fy = (ch.position.y / (it.rect.height * px)).toDouble().coerceIn(0.0, 1.0)
                    if (ch.type == PointerType.Touch) when (ev.type) {
                        PointerEventType.Press -> onTouchPress(it.index, fx, fy)
                        PointerEventType.Release -> onTouchRelease(it.index, fx)
                        else -> {}
                    } else when (ev.type) {
                        PointerEventType.Enter, PointerEventType.Move -> if (!ch.pressed) onHover(it.index, fx)
                        PointerEventType.Exit -> onHover(-1, fx)
                        PointerEventType.Press -> onPress(it.index, fx, fy)
                        PointerEventType.Release -> onRelease(it.index, fx)
                        else -> {}
                    }
                }
            }
        }) {
        RatingGlyph(paint.emptyIcon, size, paint.emptyFill.toFloat(), paint.emptyWeight, srCssColorOf(paint.inactiveColor))
        // The filled copy, clipped from the inline-end side (left edge in RTL).
        RatingGlyph(paint.icon, size, 1f, 500, srCssColorOf(paint.activeColor), Modifier.drawWithContent {
            val keep = (1 - it.clipPct / 100).toFloat() * this.size.width
            if (it.clipFromLeft) clipRect(left = this.size.width - keep) { this@drawWithContent.drawContent() }
            else clipRect(right = keep) { this@drawWithContent.drawContent() }
        })
        if (it.stateVisible && it.stateOpacity > 0) RatingGlyph(paint.icon, size, 1f, 500, srCssColorOf(paint.stateLayerColor), Modifier.alpha(it.stateOpacity.toFloat()))
        val rad = it.rippleRadiusPct
        if (it.stateVisible && rad != null) {
            RatingGlyph(paint.icon, size, 1f, 500, srCssColorOf(paint.stateLayerColor), Modifier.alpha(it.rippleOpacity.toFloat()).drawWithContent {
                val rr = (RatingLayout.rippleRadiusPx(rad, it.rect.width, it.rect.height) * px).toFloat()
                val c = Offset((it.rippleXPct / 100 * this.size.width).toFloat(), (it.rippleYPct / 100 * this.size.height).toFloat())
                clipPath(Path().apply { addOval(androidx.compose.ui.geometry.Rect(c, rr)) }) { this@drawWithContent.drawContent() }
            })
        }
    }
}
