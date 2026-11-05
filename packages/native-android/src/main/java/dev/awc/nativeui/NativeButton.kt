package dev.awc.nativeui

import android.animation.ValueAnimator
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.*
import androidx.compose.foundation.*
import androidx.compose.foundation.interaction.*
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
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
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.layout.layout
import androidx.compose.ui.layout.SubcomposeLayout
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.PlatformTextStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.*
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.style.LineHeightStyle
import androidx.compose.ui.text.style.TextMotion
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
private val ButtonFonts = FontFamily(Font(R.font.awc_roboto_regular, FontWeight.Normal), Font(R.font.awc_roboto_medium, FontWeight.Medium), Font(R.font.awc_roboto_bold, FontWeight.Bold))

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
@Composable internal fun NativeButton(source: Props, emit: EventSink, slot: Slot?) {
    val appearance = LocalAWCButtonAppearance.current
    var localSelected by awcState(source["selected"]) { source.bool("selected") }
    val groups = LocalButtonGroupAncestors.current
    val group = groups.lastOrNull()
    val identity = LocalButtonGroupChild.current?.id ?: remember { Any() }
    groups.forEach { it.register(identity,source.str("value"),localSelected) }
    val direct=group?.directChildren?.contains(identity)==true
    val syncOwner=groups.maxByOrNull { it.syncRevision }
    val p = if (syncOwner == null) source else source + mapOf(
        "toggle" to true, "size" to syncOwner.props.str("size", "sm"), "shape" to syncOwner.props.str("shape", "round"),
        "density" to (source.num("density").takeIf { it < 0 } ?: group!!.props.num("density")),
        "connectedLeft" to (syncOwner.props.str("variant") == "connected" && syncOwner.indices.indexOf(identity) > 0),
        "connectedRight" to (syncOwner.props.str("variant") == "connected" && syncOwner.indices.indexOf(identity) < syncOwner.indices.lastIndex))
    val selected = group?.states?.get(identity) ?: localSelected
    groups.forEach { member -> DisposableEffect(member,identity) { onDispose { member.remove(identity) } } }
    SideEffect { if(group!=null) localSelected=selected }
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
    var pointerActivation by remember { mutableStateOf<AWCActivationMetadata?>(null) }
    val density = LocalDensity.current.density
    val interactionPressed by interactions.collectIsPressedAsState()
    var keyboardPressed by remember { mutableStateOf(false) }
    var keyboardPulse by remember { mutableIntStateOf(0) }
    val pressed = enabled && (interactionPressed || keyboardPressed)
    // Loading blocks TSX-style activation/morph/ripple, but the source's
    // :active selector still paints its pointer-down state layer/elevation.
    val visualPressed = p.enabled() && (interactionPressed || keyboardPressed)
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
    val nativeFocus = nativeButtonFocusModifier(p, identity, group?.focus, selected,groups.map { it.focus })
    val focused = nativeFocus.isFocusVisible
    val reduceMotion = LocalAWCButtonReducedMotion.current ?: !ValueAnimator.areAnimatorsEnabled()
    val waves = remember { mutableStateListOf<NativeWave>() }
    var frameTime by remember { mutableLongStateOf(0L) }
    LaunchedEffect(interactions, enabled, p.bool("ripple", true), reduceMotion, density) {
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
                    waves.removeAll { wave -> wave.release?.let { end -> frameTime > max((wave.start ?: frameTime) + 450_000_000L, end) + 150_000_000L } ?: false }
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
    val effectiveDensity=resolveAWCDensity(p["density"],LocalAWCNativeDensity.current).toFloat()
    val metrics = remember(p.str("size"), effectiveDensity, p.str("variant")) { NativeButtonMetrics(p.str("size","sm"), effectiveDensity, p.str("variant","filled")) }
    val palette = NativeButtonPalette.resolve(p.str("variant","filled"), p.bool("toggle"), selected, !p.enabled())
    val motion = !reduceMotion && !palette.disabled
    val radius by animateFloatAsState(appearance.cornerRadius?.toFloat() ?: metrics.radius(p.str("shape") == "square", p.bool("shapeMorph",true), selected, pressed), tween(if(!motion) 0 else if(pressed) 200 else 400, easing = if(pressed) Standard else Release), label = "source button radius")
    val connected = p.bool("connectedLeft") || p.bool("connectedRight")
    val fallbackLeading = if(connected) { if(p.bool("connectedLeft") || p.str("shape") == "square") metrics.connectedRadius else metrics.roundRadius } else radius
    val fallbackTrailing = if(connected) { if(p.bool("connectedRight") || p.str("shape") == "square") metrics.connectedRadius else metrics.roundRadius } else radius
    val groupCorners=if(direct && group?.props?.str("variant")=="connected" && connected) buttonGroupCorners(group!!.props.str("size","sm"),group.props.str("shape")=="square",false,p.bool("connectedLeft"),p.bool("connectedRight"),selected,pressed) else null
    val groupLeading by animateFloatAsState(groupCorners?.first ?: fallbackLeading,tween(if(!motion) 0 else if(pressed) 200 else 400,easing=if(pressed) Standard else Release),label="group button start corners")
    val groupTrailing by animateFloatAsState(groupCorners?.second ?: fallbackTrailing,tween(if(!motion) 0 else if(pressed) 200 else 400,easing=if(pressed) Standard else Release),label="group button end corners")
    val leading=if(groupCorners!=null) groupLeading else fallbackLeading
    val trailing=if(groupCorners!=null) groupTrailing else fallbackTrailing
    val shape = RoundedCornerShape(topStart = leading.dp, topEnd = trailing.dp, bottomEnd = trailing.dp, bottomStart = leading.dp)
    val colorDuration = if(!motion) 0 else if(pressed && p.bool("shapeMorph",true)) 200 else 100
    fun appearanceColor(value: String?, fallback: Color) = value?.let(::statusDotColor) ?: fallback
    fun Color.contentOpacity(opacity:Float)=copy(alpha=alpha*opacity)
    val contentAlpha = if(palette.disabled) .38f else 1f
    val baseLabel = appearanceColor(appearance.labelColor, roleColor(palette.label))
    val container by animateColorAsState(appearanceColor(appearance.containerColor, roleColor(palette.container)).contentOpacity(if(palette.container == null && appearance.containerColor == null) 0f else if(palette.disabled) .12f else 1f), tween(colorDuration, easing=Standard), label="source button container")
    val label by animateColorAsState(baseLabel.contentOpacity(contentAlpha), tween(colorDuration, easing=Standard), label="source button label")
    val icon by animateColorAsState(appearanceColor(appearance.iconColor, baseLabel).contentOpacity(contentAlpha), tween(colorDuration, easing=Standard), label="source leading icon color")
    val trailingIcon by animateColorAsState(appearanceColor(appearance.trailingIconColor, appearanceColor(appearance.iconColor, baseLabel)).contentOpacity(contentAlpha), tween(colorDuration, easing=Standard), label="source trailing icon color")
    val loadingColor by animateColorAsState(appearanceColor(appearance.loadingColor, baseLabel).contentOpacity(contentAlpha), tween(colorDuration, easing=Standard), label="source loading color")
    val outlineRole = if(p.enabled() && (hovered || focused) && palette.outline == "outline") "primary" else palette.outline
    val outline by animateColorAsState(appearanceColor(appearance.outlineColor, roleColor(outlineRole ?: if(appearance.outlineWidth != null) "outline" else null)).contentOpacity(if(palette.outline == null && appearance.outlineColor == null && appearance.outlineWidth == null) 0f else if(palette.disabled) .12f else 1f), tween(colorDuration, easing=Standard), label="source button outline")
    val opacity by animateFloatAsState(if(!p.enabled()) 0f else if(appearance.stateLayerOpacity!=null) appearance.stateLayerOpacity.toFloat() else if(visualPressed) appearance.pressedOpacity?.toFloat() ?: .12f else if(focused) appearance.focusOpacity?.toFloat() ?: .12f else if(hovered) appearance.hoverOpacity?.toFloat() ?: .08f else 0f, tween(if(!motion) 0 else if(visualPressed) 50 else 100, easing=if(visualPressed) Release else Standard), label="source button state layer")
    val stateColor = appearanceColor(appearance.stateLayerColor, baseLabel)
    val iconSize = appearance.iconSize?.toFloat() ?: metrics.icon
    val trailingIconSize = appearance.trailingIconSize?.toFloat() ?: iconSize
    val loadingSize = appearance.loadingSize?.toFloat() ?: max(10f, iconSize * .7f)
    val lineHeight = appearance.lineHeight?.toFloat() ?: metrics.lineHeight
    val minimumLineHeight = with(LocalDensity.current) { lineHeight.sp.toDp() }
    val outlineWidth = appearance.outlineWidth?.toFloat() ?: if(p.str("variant") == "outlined") metrics.outlineWidth else 0f
    // A Compose border paints inside the box. CSS includes its border in the
    // outer-edge inline inset; reserve that full inset without adding it twice.
    val paddingInline = max((appearance.paddingInline?.toFloat() ?: metrics.padding)+(groups.firstNotNullOfOrNull { it.motionOffsets[identity] } ?: 0f), outlineWidth)
    val paddingBlock = (appearance.paddingBlock?.toFloat() ?: 0f) + outlineWidth
    val groupAppearance=if(direct) LocalAWCButtonGroupAppearance.current else null
    val connectedFloor=if(direct && group?.props?.str("variant")=="connected" && group.props.str("size") in listOf("xs","sm")) 48f else 0f
    val minimumWidth = max(connectedFloor,max(appearance.minWidth?.toFloat() ?: metrics.minimumWidth, paddingInline * 2))
    val maximumWidth = appearance.maxWidth?.toFloat()?.coerceAtLeast(minimumWidth) ?: Float.POSITIVE_INFINITY
    val minimumHeight = max(groupAppearance?.maxHeight?.toFloat() ?: appearance.minHeight?.toFloat() ?: metrics.height, paddingBlock * 2)
    if(direct) group!!.childSizing[identity]=ButtonGroupSizing(minimumWidth,paddingInline*2,minimumHeight,appearance.height?.toFloat()?.coerceAtLeast(minimumHeight)?.coerceAtMost(groupAppearance?.maxHeight?.toFloat()?.coerceAtLeast(minimumHeight) ?: Float.POSITIVE_INFINITY))
    val widthModifier = if(direct) Modifier.widthIn(min=minimumWidth.dp).then(if(appearance.width!=null && !group!!.props.bool("fullWidth")) Modifier.width(appearance.width!!.dp) else Modifier) else appearance.width?.toFloat()?.coerceIn(minimumWidth,maximumWidth)?.let { Modifier.requiredWidth(it.dp) }
        ?: Modifier.requiredWidthIn(min=minimumWidth.dp).widthIn(max=maximumWidth.dp)
            .then(if(p.bool("fullWidth")) Modifier.fillMaxWidth() else Modifier)
    val heightModifier = if(direct) Modifier.heightIn(min=minimumHeight.dp,max=(groupAppearance?.maxHeight?.toFloat()?.coerceAtLeast(minimumHeight) ?: Float.POSITIVE_INFINITY).dp).then(if(appearance.height!=null) Modifier.height(appearance.height!!.dp) else Modifier) else appearance.height?.toFloat()?.coerceAtLeast(minimumHeight)?.let { Modifier.requiredHeight(it.dp) }
        ?: Modifier.requiredHeightIn(min=minimumHeight.dp)
    // CSS box-shadow: the source --md-sys-elevation-N token drawn outside the border box (it never shows through a
    // translucent container), transitioning between levels with the container colors.
    val elevation by animateFloatAsState((if(p.enabled() && hovered && !visualPressed && !focused) palette.hoverElevation else palette.elevation).toFloat(), tween(colorDuration, easing=Standard), label="source button elevation")
    val themeTokens = LocalAWCThemeTokens.current
    val elevationLevels = remember(themeTokens) { awcElevationTokenLayers(themeTokens) }
    val shadowRtl = LocalLayoutDirection.current == LayoutDirection.Rtl
    fun shadowCorner(r: Float) = AWCCornerRadius(AWCCornerLength(r.toDouble()), AWCCornerLength(r.toDouble()))
    val shadowShape = if(shadowRtl) AWCCornerShape(shadowCorner(trailing), shadowCorner(leading), shadowCorner(leading), shadowCorner(trailing))
        else AWCCornerShape(shadowCorner(leading), shadowCorner(trailing), shadowCorner(trailing), shadowCorner(leading))
    val focusColor = appearanceColor(appearance.focusRingColor, MaterialTheme.colorScheme.secondary)
    val role = nativeButtonRole(p)
    val gridCell = LocalAWCGridCell.current
    val anchor=LocalNativeAnchor.current
    val activate: (AWCActivationMetadata) -> Unit = activate@{ activation ->
        if(anchor?.activate(activation)==true) return@activate
        performNativeButtonAction(p, selected, emit, action, form, router, p.bool("toggle") || group != null,
            targetID = actionTarget?.id ?: actionID, targetListeners = actionTarget?.listeners?.invoke().orEmpty(), activation = activation) { proposed ->
            localSelected = proposed
            if (group != null) group.states[identity] = proposed
            localSelected
        }
        if (!p.bool("disabled") && group != null) {
            groups.asReversed().forEach { it.reconcileButtonClick(identity,activation=activation) }
            localSelected = group.states[identity] == true
        }
    }
    val click: () -> Unit = {
        val activation = pointerActivation ?: AWCActivationMetadata("accessibility")
        pointerActivation = null
        activate(activation)
    }
    val latestClick = rememberUpdatedState { activate(AWCActivationMetadata()) }
    val isSubmitControl = p.str("type") == "submit" && p.str("href").isEmpty()
    DisposableEffect(form, identity, isSubmitControl) {
        if (isSubmitControl) form?.registerSubmitButton(identity) { latestClick.value() }
        onDispose { form?.unregisterSubmitButton(identity) }
    }
    val textStyle = TextStyle(fontFamily = ButtonFonts, fontSize = (appearance.fontSize?.toFloat() ?: metrics.fontSize).sp, fontWeight = FontWeight(appearance.fontWeight?.toInt() ?: metrics.weight), lineHeight = lineHeight.sp, letterSpacing = (appearance.letterSpacing?.toFloat() ?: metrics.tracking).sp, textMotion=TextMotion.Animated,platformStyle = PlatformTextStyle(includeFontPadding = false),
        lineHeightStyle = LineHeightStyle(LineHeightStyle.Alignment.Center, LineHeightStyle.Trim.None, LineHeightStyle.Mode.Fixed))
    val inspection = LocalAWCInspection.current
    val direction = if (LocalLayoutDirection.current == LayoutDirection.Rtl) "rtl" else "ltr"
    val contentGap = appearance.gap?.toFloat() ?: metrics.gap
    val rootInspection = if (inspection == null) null else AWCInspectionMetrics(
        padding = AWCInspectionInsets(paddingBlock.toDouble(), paddingInline.toDouble(), paddingBlock.toDouble(), paddingInline.toDouble()),
        margin = AWCInspectionInsets(), border = AWCInspectionInsets(outlineWidth.toDouble(), outlineWidth.toDouble(), outlineWidth.toDouble(), outlineWidth.toDouble()),
        gap = AWCInspectionGap(0.0, contentGap.toDouble()),
        typography = AWCInspectionTypography(textStyle.fontSize.value.toDouble(), textStyle.lineHeight.value.toDouble(),
            textStyle.fontWeight!!.weight, textStyle.letterSpacing.value.toDouble(), "Roboto"),
        display = "Box", direction = direction)
    CompositionLocalProvider(LocalContentColor provides label) {
        // The button's own content colour governs its text, as the source button sets `color` on its own box: an ancestor's
        // text-style colour (a card's ink, 38 % when disabled) must not override the label.
        CompositionLocalProvider(androidx.compose.material3.LocalTextStyle provides androidx.compose.material3.LocalTextStyle.current.merge(textStyle).copy(color=Color.Unspecified)) {
            Box(Modifier.then(widthModifier).then(heightModifier)
                .inspectAWCNode(inspection, "", "md-button", rootInspection)
                .zIndex(if(focused) 1f else 0f)
                .accordionShadow(shadowShape, { awcElevationLayers(elevationLevels, elevation) }, false)
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
                    // <md-ripple> precedes the state-layer span in the source shadow DOM: the state layer paints over the wave.
                    if(p.bool("ripple",true)) waves.forEach { wave ->
                        val start = wave.start ?: frameTime
                        val elapsed = max(0f,(frameTime-start)/1_000_000f)
                        val origin = wave.press.pressPosition.takeIf { it.x.isFinite() && it.y.isFinite() } ?: center
                        val radiusPx = hypot(max(origin.x,size.width-origin.x), max(origin.y,size.height-origin.y))
                        // md-ripple's wave ignores reduced motion (Chrome: 450 ms grow, 150 ms fade with reduce set).
                        val growth = Standard.transform((elapsed/450f).coerceIn(0f,1f))
                        val fadeStart = wave.release?.let { max(450f,(it-start)/1_000_000f) } ?: Float.POSITIVE_INFINITY
                        val alpha = .12f*(1f-Standard.transform(((elapsed-fadeStart)/150f).coerceIn(0f,1f)))
                        // md-ripple paints its wave in currentColor: the host's label color, not the state-layer color.
                        drawCircle(label.copy(alpha=label.alpha*alpha), radiusPx*growth, origin)
                    }
                    drawRect(stateColor.copy(alpha=stateColor.alpha*opacity))
                    drawContent()
                }
                .then(if(outlineWidth > 0f) Modifier.border(outlineWidth.dp,outline,shape) else Modifier)
                .then(if(groups.isEmpty()) Modifier else Modifier.buttonGroupTree(child=identity)).then(nativeFocus.modifier)
                .pointerInput(density) {
                    awaitEachGesture {
                        val down=awaitFirstDown(requireUnconsumed=false,pass=PointerEventPass.Initial)
                        pointerActivation=AWCActivationMetadata("pointer",down.position.x/density,down.position.y/density)
                        if(!p.bool("disabled")) groups.asReversed().forEach { it.startMotion(identity) }
                        // Clickable consumes the release in Main. Clear in Final
                        // so a later semantics action cannot inherit stale input.
                        do { val event=awaitPointerEvent(PointerEventPass.Final) } while(event.changes.any { it.pressed })
                        pointerActivation=null
                    }
                }
                .onPreviewKeyEvent { event ->
                    if(event.key !in listOf(Key.Enter, Key.NumPadEnter, Key.Spacebar)) false
                    else {
                        // Source md-button activates on keydown, with a 150ms
                        // visual pulse even when keyup arrives in the same frame.
                        // Share pointer press/ripple rendering without letting
                        // clickable dispatch a second activation on keyup.
                        if(event.type==KeyEventType.KeyDown && !p.bool("disabled")) groups.asReversed().forEach { it.startMotion(identity) }
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
                            pointerActivation = null
                            activate(AWCActivationMetadata("keyboard"))
                        }
                        true
                    }
                }
                .clickable(interactionSource=interactions, indication=null, enabled=!p.bool("disabled"), role=if(role == "gridcell") null else Role.Button, onClick=click)
                .semantics {
                    if(!enabled) disabled()
                    p.str("aria-label").takeIf { it.isNotEmpty() }?.let { contentDescription=it }   // Web aria-label replaces the content name
                    if(p.bool("toggle") || group != null || role == "gridcell") this.selected=selected
                    if(role == "gridcell") {
                        val cell = gridCell ?: AWCGridCell(0, 0)
                        collectionItemInfo = CollectionItemInfo(cell.row, cell.rowSpan, cell.column, cell.columnSpan)
                    }
                }
                .nativeMenuAnchorSemantics(p.str("id"))
                .sourcePadding(paddingInline.dp, paddingBlock.dp), contentAlignment=Alignment.Center) {
                ButtonSlotRow(contentGap.dp, minimumLineHeight,
                    Modifier.wrapContentSize(unbounded = true).inspectAWCNode(inspection, "content", "Content", AWCInspectionMetrics(
                        padding = AWCInspectionInsets(), margin = AWCInspectionInsets(), border = AWCInspectionInsets(),
                        gap = AWCInspectionGap(0.0, contentGap.toDouble()), display = "Row", direction = direction))) {
                    ButtonVisualPart(iconSize.toDouble(), icon, Modifier.inspectAWCNode(inspection, "content.leading-icon", "Leading icon", AWCInspectionMetrics(display = "Slot", direction = direction)),
                        part = "content.leading-icon", mirrored = p.bool("mirrorIcon")) { partModifier ->
                        ButtonSlot("leading-icon", slot, slots, partModifier) { if(p.str("icon").isNotBlank()) AWCMaterialSymbol(p.str("icon")) }
                    }
                    // Authored label text (the default slot) is laid out like the source's nowrap label: source text advances
                    // (letter spacing included at every glyph, as in Chrome), not Compose's paragraph width.
                    CompositionLocalProvider(LocalAWCSourceText provides true, LocalAWCSlotTextNoWrap provides true) {
                    ButtonSlot("", slot, slots, Modifier.inspectAWCNode(inspection, "content.label", "Label", AWCInspectionMetrics(display = "Slot", direction = direction)).then(if(p.str("aria-label").isNotEmpty()) Modifier.clearAndSetSemantics { } else Modifier),
                        lineBoxHeight=if(appearance.lineHeight!=null) minimumLineHeight else null) {
                        if(p.label().isNotBlank()) {
                            val textInspection = rememberAWCInspectionText("content.label.text", family = "Roboto")
                            NativeSourceText(p.label(),style=textStyle,modifier=textInspection.modifier.then(if(p.str("aria-label").isNotEmpty()) Modifier.clearAndSetSemantics { } else Modifier),onTextLayout=textInspection.onTextLayout,wrap=false)
                        }
                    }
                    }
                    ButtonVisualPart(trailingIconSize.toDouble(), trailingIcon, Modifier.inspectAWCNode(inspection, "content.trailing-icon", "Trailing icon", AWCInspectionMetrics(display = "Slot", direction = direction)),
                        part = "content.trailing-icon", mirrored = p.bool("mirrorIcon"),
                        expanded = p.bool("aria-expanded") && !p.bool("suppressExpandIconFlip")) { partModifier ->
                        ButtonSlot("trailing-icon", slot, slots, partModifier) { if(p.str("trailingIcon").isNotBlank()) AWCMaterialSymbol(p.str("trailingIcon")) }
                    }
                    if(p.bool("loading")) ButtonVisualPart(null, loadingColor, Modifier.inspectAWCNode(inspection, "content.loader", "Loader", AWCInspectionMetrics(display = "Slot", direction = direction)),
                        part = "content.loader", inheritedSize = loadingSize.dp) { partModifier ->
                        ButtonSlot("loader",slot, slots, partModifier) { NativeButtonLoading(loadingSize.dp,loadingColor,reduceMotion) }
                    }
                }
            }
        }
    }
}

/** Padding whose two sides round once together: CSS lays the content box out at fractional positions, so an inset of
 *  11.25dp adds 22.5dp to the border box, not 2 × 11.5dp (per-side rounding drifted density buttons up to a pixel). */
private fun Modifier.sourcePadding(inline: Dp, block: Dp) = layout { measurable, constraints ->
    val horizontal = (inline * 2).roundToPx(); val vertical = (block * 2).roundToPx()
    val start = inline.roundToPx().coerceIn(0, horizontal); val top = block.roundToPx().coerceIn(0, vertical)
    val placeable = measurable.measure(constraints.offset(-horizontal, -vertical))
    layout(constraints.constrainWidth(placeable.width + horizontal), constraints.constrainHeight(placeable.height + vertical)) { placeable.placeRelative(start, top) }
}

/** Scope colors without replacing a caller's explicitly styled content. */
@Composable private fun ButtonVisualPart(size: Double?, color: Color, modifier: Modifier,
    part: String, inheritedSize: Dp = size?.dp ?: 20.dp, mirrored: Boolean = false, expanded: Boolean = false,
    content: @Composable (Modifier) -> Unit) {
    val flip = mirrored && LocalLayoutDirection.current == LayoutDirection.Rtl
    val rotation by animateFloatAsState(if(expanded && !flip) 180f else 0f,
        tween(if(ValueAnimator.areAnimatorsEnabled()) 100 else 0, easing=Standard), label="source icon expansion")
    val transform = Modifier.graphicsLayer { scaleX=if(flip) -1f else 1f; rotationZ=rotation }
    CompositionLocalProvider(LocalContentColor provides color, LocalAWCButtonSlotSize provides inheritedSize, LocalAWCButtonSlotPart provides part) {
        if(size == null) content(modifier)
        else SubcomposeLayout(modifier = modifier.then(transform)) { constraints ->
            val children = subcompose("part") { content(Modifier) }.map { it.measure(constraints.copy(minWidth=0, minHeight=0, maxWidth=min(constraints.maxWidth, size.dp.roundToPx()), maxHeight=min(constraints.maxHeight, size.dp.roundToPx()))) }
            // Appearance alone must not create an otherwise absent icon/slot.
            val visible = children.any { it.width > 0 || it.height > 0 }
            val width = if(visible) constraints.constrainWidth(size.dp.roundToPx()) else 0
            val height = if(visible) constraints.constrainHeight(size.dp.roundToPx()) else 0
            layout(width, height) { children.forEach { it.placeRelative((width-it.width)/2, (height-it.height)/2) } }
        }
    }
}

/** Only non-empty slots contribute a source gap; provided slot content replaces fallback. */
@Composable private fun ButtonSlotRow(gap: Dp, minimumHeight: Dp, modifier: Modifier, content: @Composable () -> Unit) {
    Layout(content=content, modifier=modifier) { measurables,constraints ->
        val items = measurables.map { it.measure(constraints.copy(minWidth=0,minHeight=0)) }.filter { it.width > 0 || it.height > 0 }
        val width = constraints.constrainWidth(items.sumOf { it.width } + max(0,items.size-1)*gap.roundToPx())
        val height = constraints.constrainHeight(max(minimumHeight.roundToPx(),items.maxOfOrNull { it.height } ?: 0))
        layout(width,height) { var x=0; items.forEach { it.placeRelative(x,(height-it.height)/2); x += it.width+gap.roundToPx() } }
    }
}

@Composable private fun ButtonSlot(name: String, slot: Slot?, registry: AWCSlotRegistry?, modifier: Modifier = Modifier,
    lineBoxHeight: Dp? = null, fallback: @Composable () -> Unit) {
    SubcomposeLayout(modifier = modifier) { constraints ->
        val childConstraints=constraints.copy(minWidth=0,minHeight=0,maxHeight=if(lineBoxHeight!=null) Constraints.Infinity else constraints.maxHeight)
        val registered=registry?.contains(name)==true
        val proposed = subcompose("slot") { if(registered) registry?.Render(name) else slot?.invoke(name) }.map { it.measure(childConstraints) }
        val content = if(registered || proposed.any { it.width > 0 || it.height > 0 }) proposed else subcompose("fallback",fallback).map { it.measure(childConstraints) }
        val height=lineBoxHeight?.roundToPx() ?: (content.maxOfOrNull { it.height } ?: 0)
        layout(content.sumOf { it.width },height) { var x=0; content.forEach { it.placeRelative(x,(height-it.height)/2); x+=it.width } }
    }
}

internal val LocalAWCButtonReducedMotion = staticCompositionLocalOf<Boolean?> { null }
/** Overrides the system animator setting for md-button family motion (tests and previews); null follows the system. */
@Composable fun AWCButtonReducedMotionScope(reduced: Boolean?, content: @Composable () -> Unit) =
    CompositionLocalProvider(LocalAWCButtonReducedMotion provides reduced, content = content)
