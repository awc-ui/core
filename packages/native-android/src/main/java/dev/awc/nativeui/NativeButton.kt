package dev.awc.nativeui

import android.animation.ValueAnimator
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.*
import androidx.compose.foundation.*
import androidx.compose.foundation.interaction.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.draw.*
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.*
import androidx.compose.ui.graphics.drawscope.*
import androidx.compose.ui.input.key.*
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.layout.SubcomposeLayout
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.PlatformTextStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.*
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.*
import dev.awc.nativeui.generated.AWCGeneratedTokens
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.isActive
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlin.math.*

/** Source md-button.css metrics; independent of Compose measurement for regression checks. */
internal data class NativeButtonMetrics(val size: String, val density: Float, val variant: String) {
    private val index = listOf("xs", "sm", "md", "lg", "xl").indexOf(size).takeIf { it >= 0 } ?: 1
    private val rung = density.takeIf { it in listOf(-1f, -2f, -3f, -4f) } ?: 0f
    private fun taper(base: List<Float>, slope: List<Float>, floor: List<Float>) = max(floor[index], base[index] + rung * slope[index])
    val height = max(24f, listOf(32f, 40f, 56f, 96f, 136f)[index] + rung * 4f)
    val minimumWidth = max(40f, listOf(48f, 58f, 72f, 88f, 120f)[index] + rung * 4f)
    private val inset = listOf(12f, 16f, 24f, 48f, 64f)[index]
    // Compose borders paint inside the measured bounds. This is the full outer
    // inset, including the outline, so outlined content aligns with other variants.
    val padding = max(inset / 2f, inset + rung * inset / 16f)
    val outlineWidth = listOf(1f, 1f, 1f, 2f, 3f)[index]
    val gap = taper(listOf(4f,8f,8f,12f,16f), listOf(.5f,1f,1f,1.5f,2f), listOf(2f,4f,4f,6f,8f))
    val icon = taper(listOf(20f,20f,24f,32f,40f), listOf(2.5f,2.5f,3f,4f,5f), listOf(10f,10f,12f,16f,20f))
    val loading = max(10f, icon * .7f)
    val fontSize = taper(listOf(14f,14f,16f,24f,32f), listOf(.5f,.5f,.5f,1f,2f), listOf(12f,12f,13f,18f,24f))
    val lineHeight = taper(listOf(20f,20f,24f,32f,40f), listOf(1f,1f,1f,2f,2f), listOf(16f,16f,18f,24f,32f))
    val typeRole = listOf("label-large", "label-large", "title-medium", "headline-small", "headline-large")[index]
    val tracking = token("--md-sys-typescale-$typeRole-letter-spacing", listOf(.1f,.1f,.15f,0f,0f)[index])
    val weight = token("--md-sys-typescale-$typeRole-font-weight", if(index >= 3) 400f else 500f).toInt()
    val roundRadius = listOf(16f,20f,28f,48f,68f)[index]
    val squareRadius = token("--md-sys-shape-corner-${listOf("medium","medium","large","extra-large","extra-large")[index]}", listOf(12f,12f,16f,28f,28f)[index])
    val pressedRadius = token("--md-sys-shape-corner-${listOf("small","small","medium","large","large")[index]}", listOf(8f,8f,12f,16f,16f)[index])
    val connectedRadius = listOf(4f,8f,8f,16f,20f)[index]
    fun radius(square: Boolean, morph: Boolean, selected: Boolean, pressed: Boolean): Float =
        if(!morph) { if(square) squareRadius else roundRadius }
        else if(pressed) pressedRadius
        else if(square != selected) squareRadius else roundRadius
}

private fun token(key: String, fallback: Float): Float = AWCGeneratedTokens.light[key]?.removeSuffix("px")?.removeSuffix("ms")?.toFloatOrNull() ?: fallback
private val Standard = CubicBezierEasing(.2f,0f,0f,1f)
private val Release = CubicBezierEasing(.05f,.7f,.1f,1f)
private val ButtonFonts = FontFamily(Font(R.font.awc_roboto_regular, FontWeight.Normal), Font(R.font.awc_roboto_medium, FontWeight.Medium))
private val SymbolFont = FontFamily(Font(R.font.awc_material_symbols))

internal data class NativeButtonPalette(val container: String?, val label: String, val outline: String?, val elevation: Int, val hoverElevation: Int, val disabled: Boolean) {
    companion object {
        fun resolve(variant: String, toggle: Boolean, selected: Boolean, disabled: Boolean): NativeButtonPalette {
            if(disabled) return NativeButtonPalette(if(variant in listOf("filled","tonal","elevated")) "on-surface" else null, "on-surface", if(variant == "outlined") "on-surface" else null, 0, 0, true)
            return when(variant) {
                "filled" -> if(toggle && !selected) NativeButtonPalette("surface-container-highest","primary",null,0,1,false) else NativeButtonPalette("primary","on-primary",null,0,1,false)
                "tonal" -> if(toggle && !selected) NativeButtonPalette("surface-container-highest","on-surface-variant",null,0,1,false) else NativeButtonPalette("secondary-container","on-secondary-container",null,0,1,false)
                "outlined" -> if(toggle && selected) NativeButtonPalette("secondary-container","on-secondary-container",null,0,0,false) else NativeButtonPalette(null,"primary","outline",0,0,false)
                "elevated" -> if(toggle && !selected) NativeButtonPalette("surface-container-highest","on-surface-variant",null,0,0,false) else NativeButtonPalette("surface-container-low","primary",null,1,2,false)
                else -> NativeButtonPalette(null,if(toggle && !selected) "on-surface-variant" else "primary",null,0,0,false)
            }
        }
    }
}

@Composable private fun roleColor(role: String?): Color = with(MaterialTheme.colorScheme) { when(role) {
    "primary" -> primary; "on-primary" -> onPrimary; "secondary-container" -> secondaryContainer
    "on-secondary-container" -> onSecondaryContainer; "surface-container-highest" -> surfaceContainerHighest
    "surface-container-low" -> surfaceContainerLow; "on-surface-variant" -> onSurfaceVariant
    "on-surface" -> onSurface; "outline" -> outline; "secondary" -> secondary; else -> Color.Transparent
} }

private data class NativeWave(val press: PressInteraction.Press, val start: Long? = null, val release: Long? = null, val released: Boolean = false)

/** A true Compose click/press target; no simulated JavaScript state or web surface. */
@Composable internal fun NativeButton(p: Props, emit: EventSink, slot: Slot?) {
    val appearance = LocalAWCButtonAppearance.current
    var localSelected by awcState(p["selected"]) { p.bool("selected") }
    val group = LocalSelection.current?.takeIf { it.tag == "md-button-group" }
    val identity = remember { Any() }
    group?.register(identity, p.str("value"), localSelected)
    val selected = group?.states?.get(identity) ?: localSelected
    DisposableEffect(group, identity) { onDispose { group?.remove(identity) } }
    LaunchedEffect(p["selected"]) { if(group != null) group.states[identity] = p.bool("selected") }
    val uri = LocalUriHandler.current
    val router = LocalAWCURLRouter.current ?: remember(uri) {
        AWCURLRouter { request ->
            if (!java.net.URI(request.url).isAbsolute) false
            else runCatching { uri.openUri(request.url); true }.getOrDefault(false)
        }
    }
    val action = LocalAWCAction.current
    val actionTarget = LocalAWCActionTarget.current
    val actionID = remember { java.util.UUID.randomUUID().toString() }
    val form = currentAWCForm()
    val slots = LocalAWCSlots.current
    val enabled = p.enabled() && !p.bool("loading")
    val interactions = remember { MutableInteractionSource() }
    val interactionPressed by interactions.collectIsPressedAsState()
    var keyboardPressed by remember { mutableStateOf(false) }
    var keyboardPulse by remember { mutableIntStateOf(0) }
    val pressed = enabled && (interactionPressed || keyboardPressed)
    val keyboardScope = rememberCoroutineScope()
    var keyboardPressJob by remember { mutableStateOf<Job?>(null) }
    DisposableEffect(enabled) {
        onDispose {
            keyboardPulse++
            keyboardPressed = false
            keyboardPressJob?.cancel(); keyboardPressJob = null
        }
    }
    val hovered by interactions.collectIsHoveredAsState()
    val nativeFocus = nativeButtonFocusModifier(p, identity, group?.focus, selected)
    val focused = nativeFocus.isFocusVisible
    val reduceMotion = !ValueAnimator.areAnimatorsEnabled()
    val waves = remember { mutableStateListOf<NativeWave>() }
    var frameTime by remember { mutableLongStateOf(0L) }
    LaunchedEffect(interactions, enabled, p.bool("ripple", true), reduceMotion) {
        if(!enabled || !p.bool("ripple", true)) waves.clear()
        var waveFrames: Job? = null
        fun animateWaves() {
            if(waveFrames?.isActive == true || waves.isEmpty()) return
            // Subscribe to the next frame at interaction time. Starting this in
            // an effect keyed by waves.isNotEmpty() waits for another composition
            // before subscribing, leaving an extra blank frame at ripple onset.
            waveFrames = launch(start = CoroutineStart.UNDISPATCHED) {
                while(isActive && waves.isNotEmpty()) {
                    frameTime = withFrameNanos { it }
                    // Keep start, release and drawing on the same Compose clock,
                    // including virtual test clocks; no wall-clock conversion.
                    waves.indices.forEach { index ->
                        val wave = waves[index]
                        if (wave.start == null || (wave.released && wave.release == null)) {
                            waves[index] = wave.copy(start = wave.start ?: frameTime, release = if (wave.released) wave.release ?: frameTime else null)
                        }
                    }
                    waves.removeAll { wave -> wave.release?.let { end -> reduceMotion || frameTime > max((wave.start ?: frameTime) + 450_000_000L, end) + 150_000_000L } ?: false }
                }
            }
        }
        animateWaves()
        interactions.interactions.collect { interaction ->
            if(enabled && p.bool("ripple", true)) when(interaction) {
                is PressInteraction.Press -> {
                    waves.add(NativeWave(interaction)); if(waves.size > 4) waves.removeAt(0)
                    animateWaves()
                }
                is PressInteraction.Release -> { val index = waves.indexOfFirst { it.press == interaction.press }; if(index >= 0) waves[index] = waves[index].copy(released = true) }
                is PressInteraction.Cancel -> { val index = waves.indexOfFirst { it.press == interaction.press }; if(index >= 0) waves[index] = waves[index].copy(released = true) }
            }
        }
    }
    val metrics = remember(p.str("size"), p.num("density"), p.str("variant")) { NativeButtonMetrics(p.str("size","sm"), p.num("density"), p.str("variant","filled")) }
    val palette = NativeButtonPalette.resolve(p.str("variant","filled"), p.bool("toggle"), selected, !p.enabled())
    val motion = !reduceMotion && !palette.disabled
    val radius by animateFloatAsState(appearance.cornerRadius?.toFloat() ?: metrics.radius(p.str("shape") == "square", p.bool("shapeMorph",true), selected, pressed), tween(if(!motion) 0 else if(pressed) 200 else 400, easing = if(pressed) Standard else Release), label = "source button radius")
    val connected = p.bool("connectedLeft") || p.bool("connectedRight")
    val leading = if(appearance.cornerRadius != null) radius else if(connected) { if(p.bool("connectedLeft") || p.str("shape") == "square") metrics.connectedRadius else metrics.roundRadius } else radius
    val trailing = if(appearance.cornerRadius != null) radius else if(connected) { if(p.bool("connectedRight") || p.str("shape") == "square") metrics.connectedRadius else metrics.roundRadius } else radius
    val shape = RoundedCornerShape(topStart = leading.dp, topEnd = trailing.dp, bottomEnd = trailing.dp, bottomStart = leading.dp)
    val colorDuration = if(!motion) 0 else if(pressed && p.bool("shapeMorph",true)) 200 else 100
    fun appearanceColor(value: String?, fallback: Color) = value?.let { Color(0xFF000000L or it.drop(1).toLong(16)) } ?: fallback
    val contentAlpha = if(palette.disabled) .38f else 1f
    val baseLabel = appearanceColor(appearance.labelColor, roleColor(palette.label))
    val container by animateColorAsState(appearanceColor(appearance.containerColor, roleColor(palette.container)).copy(alpha = if(palette.container == null && appearance.containerColor == null) 0f else if(palette.disabled) .12f else 1f), tween(colorDuration, easing=Standard), label="source button container")
    val label by animateColorAsState(baseLabel.copy(alpha = contentAlpha), tween(colorDuration, easing=Standard), label="source button label")
    val icon by animateColorAsState(appearanceColor(appearance.iconColor, baseLabel).copy(alpha = contentAlpha), tween(colorDuration, easing=Standard), label="source leading icon color")
    val trailingIcon by animateColorAsState(appearanceColor(appearance.trailingIconColor, appearanceColor(appearance.iconColor, baseLabel)).copy(alpha = contentAlpha), tween(colorDuration, easing=Standard), label="source trailing icon color")
    val loadingColor by animateColorAsState(appearanceColor(appearance.loadingColor, baseLabel).copy(alpha = contentAlpha), tween(colorDuration, easing=Standard), label="source loading color")
    val outlineRole = if(enabled && (hovered || focused) && palette.outline == "outline") "primary" else palette.outline
    val outline by animateColorAsState(appearanceColor(appearance.outlineColor, roleColor(outlineRole ?: if(appearance.outlineWidth != null) "outline" else null)).copy(alpha = if(palette.outline == null && appearance.outlineColor == null && appearance.outlineWidth == null) 0f else if(palette.disabled) .12f else 1f), tween(colorDuration, easing=Standard), label="source button outline")
    val opacity by animateFloatAsState(if(!enabled) 0f else if(pressed) appearance.pressedOpacity?.toFloat() ?: .12f else if(focused) appearance.focusOpacity?.toFloat() ?: .12f else if(hovered) appearance.hoverOpacity?.toFloat() ?: .08f else 0f, tween(if(!motion) 0 else if(pressed) 50 else 100, easing=if(pressed) Release else Standard), label="source button state layer")
    val stateColor = appearanceColor(appearance.stateLayerColor, baseLabel)
    val iconSize = appearance.iconSize?.toFloat() ?: metrics.icon
    val trailingIconSize = appearance.trailingIconSize?.toFloat() ?: iconSize
    val loadingSize = appearance.loadingSize?.toFloat() ?: metrics.loading
    val lineHeight = appearance.lineHeight?.toFloat() ?: metrics.lineHeight
    val minimumLineHeight = if(appearance.lineHeight != null) with(LocalDensity.current) { lineHeight.sp.toDp() } else lineHeight.dp
    val outlineWidth = appearance.outlineWidth?.toFloat() ?: if(p.str("variant") == "outlined") metrics.outlineWidth else 0f
    // A Compose border paints inside the box. CSS includes its border in the
    // outer-edge inline inset; reserve that full inset without adding it twice.
    val paddingInline = max(appearance.paddingInline?.toFloat() ?: metrics.padding, outlineWidth)
    val paddingBlock = appearance.paddingBlock?.toFloat()?.plus(outlineWidth) ?: 0f
    val elevation by animateDpAsState((if(enabled && hovered && !pressed && !focused) palette.hoverElevation else palette.elevation).dp, tween(colorDuration, easing=Standard), label="source button elevation")
    val focusColor = MaterialTheme.colorScheme.secondary
    val role = nativeButtonRole(p)
    val gridCell = LocalAWCGridCell.current
    val click: () -> Unit = {
        performNativeButtonAction(p, selected, emit, action, form, router, p.bool("toggle") || group != null,
            targetID = actionTarget?.id ?: actionID, targetListeners = actionTarget?.listeners?.invoke().orEmpty()) { proposed ->
            localSelected = group?.toggle(identity) ?: proposed
            localSelected
        }
    }
    val latestClick = rememberUpdatedState(click)
    val isSubmitControl = p.str("type") == "submit" && p.str("href").isEmpty()
    DisposableEffect(form, identity, isSubmitControl) {
        if (isSubmitControl) form?.registerSubmitButton(identity) { latestClick.value() }
        onDispose { form?.unregisterSubmitButton(identity) }
    }
    val textStyle = TextStyle(fontFamily = ButtonFonts, fontSize = (appearance.fontSize?.toFloat() ?: metrics.fontSize).sp, fontWeight = FontWeight(appearance.fontWeight?.toInt() ?: metrics.weight), lineHeight = lineHeight.sp, letterSpacing = (appearance.letterSpacing?.toFloat() ?: metrics.tracking).sp, platformStyle = PlatformTextStyle(includeFontPadding = false))
    CompositionLocalProvider(LocalContentColor provides label) {
        ProvideTextStyle(textStyle) {
            Box((if(p.bool("fullWidth")) Modifier.fillMaxWidth() else Modifier)
                .zIndex(if(focused) 1f else 0f)
                .shadow(elevation, shape, clip=false)
                .drawBehind {
                    if(focused && !p.bool("disabled")) {
                        // Web outline: 3px stroke outside a 2px gap. Expand both
                        // bounds and corner radii so connected corners stay aligned.
                        val outset = 3.5.dp
                        val offset = outset.toPx()
                        val ringShape = RoundedCornerShape(topStart = leading.dp + outset, topEnd = trailing.dp + outset,
                            bottomEnd = trailing.dp + outset, bottomStart = leading.dp + outset)
                        val ring = ringShape.createOutline(Size(size.width + 2 * offset, size.height + 2 * offset), layoutDirection, this)
                        translate(-offset, -offset) { drawOutline(ring, focusColor, style = Stroke(3.dp.toPx())) }
                    }
                }
                .clip(shape).background(container)
                .drawWithContent {
                    drawRect(stateColor.copy(alpha=opacity))
                    if(p.bool("ripple",true)) waves.forEach { wave ->
                        val start = wave.start ?: frameTime
                        val elapsed = max(0f,(frameTime-start)/1_000_000f)
                        val origin = wave.press.pressPosition.takeIf { it.x.isFinite() && it.y.isFinite() } ?: center
                        val radiusPx = hypot(max(origin.x,size.width-origin.x), max(origin.y,size.height-origin.y))
                        val growth = if(reduceMotion) 1f else Standard.transform((elapsed/450f).coerceIn(0f,1f))
                        val fadeStart = wave.release?.let { max(450f,(it-start)/1_000_000f) } ?: Float.POSITIVE_INFINITY
                        val alpha = if(reduceMotion) { if(wave.release == null) .12f else 0f } else .12f*(1f-Standard.transform(((elapsed-fadeStart)/150f).coerceIn(0f,1f)))
                        drawCircle(stateColor.copy(alpha=alpha), radiusPx*growth, origin)
                    }
                    drawContent()
                }
                .then(if(outlineWidth > 0f) Modifier.border(outlineWidth.dp,outline,shape) else Modifier)
                .then(nativeFocus.modifier)
                .onPreviewKeyEvent { event ->
                    if(event.key !in listOf(Key.Enter, Key.NumPadEnter, Key.Spacebar)) false
                    else {
                        // Source md-button activates on keydown, with a 150ms
                        // visual pulse even when keyup arrives in the same frame.
                        // Share pointer press/ripple rendering without letting
                        // clickable dispatch a second activation on keyup.
                        if(event.type == KeyEventType.KeyDown && enabled) {
                            val pulse = ++keyboardPulse
                            // Commit press and toggle in the same snapshot. An
                            // asynchronous interaction collector must not show
                            // the selected/resting shape before the pressed shape.
                            keyboardPressed = true
                            keyboardPressJob?.cancel()
                            keyboardPressJob = keyboardScope.launch(start = CoroutineStart.UNDISPATCHED) {
                                val press = PressInteraction.Press(Offset.Unspecified)
                                try {
                                    interactions.emit(press)
                                    val start = withFrameNanos { it }
                                    var now = start
                                    while(now - start < 150_000_000L) { now = withFrameNanos { it } }
                                } finally {
                                    interactions.tryEmit(PressInteraction.Release(press))
                                    if(keyboardPulse == pulse) keyboardPressed = false
                                }
                            }
                            click()
                        }
                        true
                    }
                }
                .clickable(interactionSource=interactions, indication=null, enabled=!p.bool("disabled"), role=if(role == "gridcell") null else Role.Button, onClick=click)
                .semantics {
                    if(!enabled) disabled()
                    if(p.bool("toggle") || group != null || role == "gridcell") this.selected=selected
                    if(role == "gridcell") {
                        val cell = gridCell ?: AWCGridCell(0, 0)
                        collectionItemInfo = CollectionItemInfo(cell.row, cell.rowSpan, cell.column, cell.columnSpan)
                    }
                }
                .sizeIn(minWidth=metrics.minimumWidth.dp,minHeight=metrics.height.dp)
                .padding(horizontal=paddingInline.dp, vertical=paddingBlock.dp), contentAlignment=Alignment.Center) {
                ButtonSlotRow((appearance.gap?.toFloat() ?: metrics.gap).dp, minimumLineHeight) {
                    ButtonVisualPart(appearance.iconSize, icon) {
                        ButtonSlot("leading-icon", slot, slots) { if(p.str("icon").isNotBlank()) ButtonGlyph(p.str("icon"),iconSize,p.bool("mirrorIcon"),false) }
                    }
                    ButtonSlot("", slot, slots) { if(p.label().isNotBlank()) Text(p.label(),maxLines=1,overflow=TextOverflow.Clip) }
                    ButtonVisualPart(appearance.trailingIconSize ?: appearance.iconSize, trailingIcon) {
                        ButtonSlot("trailing-icon", slot, slots) { if(p.str("trailingIcon").isNotBlank()) ButtonGlyph(p.str("trailingIcon"),trailingIconSize,p.bool("mirrorIcon"),p.bool("aria-expanded") && !p.bool("suppressExpandIconFlip")) }
                    }
                    if(p.bool("loading")) ButtonVisualPart(appearance.loadingSize, loadingColor) {
                        ButtonSlot("loader",slot, slots) { NativeButtonLoading(loadingSize.dp,loadingColor,reduceMotion) }
                    }
                }
            }
        }
    }
}

/** Scope colors without replacing a caller's explicitly styled content. */
@Composable private fun ButtonVisualPart(size: Double?, color: Color, content: @Composable () -> Unit) {
    CompositionLocalProvider(LocalContentColor provides color) {
        if(size == null) content()
        else SubcomposeLayout { constraints ->
            val children = subcompose("part", content).map { it.measure(constraints.copy(minWidth=0, minHeight=0, maxWidth=min(constraints.maxWidth, size.dp.roundToPx()), maxHeight=min(constraints.maxHeight, size.dp.roundToPx()))) }
            // Appearance alone must not create an otherwise absent icon/slot.
            val visible = children.any { it.width > 0 || it.height > 0 }
            val width = if(visible) constraints.constrainWidth(size.dp.roundToPx()) else 0
            val height = if(visible) constraints.constrainHeight(size.dp.roundToPx()) else 0
            layout(width, height) { children.forEach { it.placeRelative((width-it.width)/2, (height-it.height)/2) } }
        }
    }
}

/** Only non-empty slots contribute a source gap; provided slot content replaces fallback. */
@Composable private fun ButtonSlotRow(gap: Dp, minimumHeight: Dp, content: @Composable () -> Unit) {
    Layout(content=content) { measurables,constraints ->
        val items = measurables.map { it.measure(constraints.copy(minWidth=0,minHeight=0)) }.filter { it.width > 0 || it.height > 0 }
        val width = constraints.constrainWidth(items.sumOf { it.width } + max(0,items.size-1)*gap.roundToPx())
        val height = constraints.constrainHeight(max(minimumHeight.roundToPx(),items.maxOfOrNull { it.height } ?: 0))
        layout(width,height) { var x=0; items.forEach { it.placeRelative(x,(height-it.height)/2); x += it.width+gap.roundToPx() } }
    }
}

@Composable private fun ButtonSlot(name: String, slot: Slot?, registry: AWCSlotRegistry?, fallback: @Composable () -> Unit) {
    if (registry?.contains(name) == true) { registry.Render(name); return }
    SubcomposeLayout { constraints ->
        val proposed = subcompose("slot") { slot?.invoke(name) }.map { it.measure(constraints.copy(minWidth=0,minHeight=0)) }
        val content = if(proposed.any { it.width > 0 || it.height > 0 }) proposed else subcompose("fallback",fallback).map { it.measure(constraints.copy(minWidth=0,minHeight=0)) }
        layout(content.sumOf { it.width },content.maxOfOrNull { it.height } ?: 0) { var x=0; content.forEach { it.placeRelative(x,0); x+=it.width } }
    }
}

@Composable private fun ButtonGlyph(name: String, size: Float, mirrored: Boolean, expanded: Boolean) {
    val flip = mirrored && LocalLayoutDirection.current == LayoutDirection.Rtl
    val rotation by animateFloatAsState(if(expanded && !flip) 180f else 0f,tween(100,easing=Standard),label="source icon expansion")
    Box(Modifier.size(size.dp).graphicsLayer { scaleX=if(flip) -1f else 1f; rotationZ=rotation },contentAlignment=Alignment.Center) {
        // Material Symbols has a 1.2em typographic line. Constraining Text to
        // the 1em icon cell truncates its measured height without moving its
        // baseline. Measure the natural line, then center it inside the cell.
        Text(name,modifier=Modifier.wrapContentSize(unbounded=true),fontFamily=SymbolFont,fontWeight=FontWeight.Normal,
            fontSize=size.sp,letterSpacing=0.sp,maxLines=1,softWrap=false,
            style=TextStyle(platformStyle=PlatformTextStyle(includeFontPadding=false),fontFeatureSettings="liga"))
    }
}
