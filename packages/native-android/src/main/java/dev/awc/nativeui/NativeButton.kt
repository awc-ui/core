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
import androidx.compose.ui.graphics.*
import androidx.compose.ui.graphics.drawscope.*
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.layout.SubcomposeLayout
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.PlatformTextStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.*
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.*
import dev.awc.nativeui.generated.AWCGeneratedTokens
import kotlinx.coroutines.isActive
import kotlin.math.*

/** Source md-button.css metrics; independent of Compose measurement for regression checks. */
internal data class NativeButtonMetrics(val size: String, val density: Float, val variant: String) {
    private val index = listOf("xs", "sm", "md", "lg", "xl").indexOf(size).takeIf { it >= 0 } ?: 1
    private val rung = density.takeIf { it in listOf(-1f, -2f, -3f, -4f) } ?: 0f
    private fun taper(base: List<Float>, slope: List<Float>, floor: List<Float>) = max(floor[index], base[index] + rung * slope[index])
    val height = max(24f, listOf(32f, 40f, 56f, 96f, 136f)[index] + rung * 4f)
    val minimumWidth = max(40f, listOf(48f, 58f, 72f, 88f, 120f)[index] + rung * 4f)
    private val inset = (if(variant == "outlined") listOf(11f, 23f, 27f, 31f, 47f) else listOf(12f, 16f, 24f, 48f, 64f))[index]
    val padding = max(inset / 2f, inset + rung * inset / 16f) + if(variant == "outlined") 1f else 0f
    val gap = taper(listOf(4f,8f,8f,12f,16f), listOf(.5f,1f,1f,1.5f,2f), listOf(2f,4f,4f,6f,8f))
    val icon = taper(listOf(20f,20f,24f,32f,40f), listOf(2.5f,2.5f,3f,4f,5f), listOf(10f,10f,12f,16f,20f))
    val loading = max(10f, icon * .7f)
    val fontSize = taper(listOf(12f,14f,14f,16f,24f), listOf(.5f,.5f,.5f,.5f,1f), listOf(10f,12f,12f,13f,18f))
    val lineHeight = taper(listOf(16f,20f,20f,24f,32f), listOf(.5f,1f,1f,1f,2f), listOf(14f,16f,16f,18f,24f))
    private val typeRole = listOf("label-medium", "label-large", "title-small", "title-medium", "headline-small")[index]
    val tracking = token("--md-sys-typescale-$typeRole-letter-spacing", listOf(.5f,.1f,.1f,.15f,0f)[index])
    val weight = token("--md-sys-typescale-$typeRole-font-weight", if(index == 4) 400f else 500f).toInt()
    val roundRadius = listOf(16f,20f,28f,48f,68f)[index]
    val squareRadius = token("--md-sys-shape-corner-${listOf("small","medium","medium","large","extra-large")[index]}", listOf(8f,12f,12f,16f,28f)[index])
    val pressedRadius = token("--md-sys-shape-corner-${listOf("extra-small","small","small","medium","large")[index]}", listOf(4f,8f,8f,12f,16f)[index])
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
    val form = LocalAWCForm.current
    val slots = LocalAWCSlots.current
    val enabled = p.enabled() && !p.bool("loading")
    val interactions = remember { MutableInteractionSource() }
    val pressed by interactions.collectIsPressedAsState()
    val hovered by interactions.collectIsHoveredAsState()
    val focused by interactions.collectIsFocusedAsState()
    val reduceMotion = !ValueAnimator.areAnimatorsEnabled()
    val waves = remember { mutableStateListOf<NativeWave>() }
    var frameTime by remember { mutableLongStateOf(0L) }
    LaunchedEffect(interactions, enabled, p.bool("ripple", true)) {
        if(!enabled || !p.bool("ripple", true)) waves.clear()
        interactions.interactions.collect { interaction ->
            if(enabled && p.bool("ripple", true)) when(interaction) {
                is PressInteraction.Press -> { waves.add(NativeWave(interaction)); if(waves.size > 4) waves.removeAt(0) }
                is PressInteraction.Release -> { val index = waves.indexOfFirst { it.press == interaction.press }; if(index >= 0) waves[index] = waves[index].copy(released = true) }
                is PressInteraction.Cancel -> { val index = waves.indexOfFirst { it.press == interaction.press }; if(index >= 0) waves[index] = waves[index].copy(released = true) }
            }
        }
    }
    LaunchedEffect(waves.isNotEmpty(), reduceMotion) {
        while(isActive && waves.isNotEmpty()) {
            frameTime = withFrameNanos { it }
            // Every timestamp uses Compose's frame clock, including virtual test
            // clocks. Mixing System.nanoTime with it can keep a wave alive forever.
            waves.indices.forEach { index ->
                val wave = waves[index]
                if (wave.start == null || (wave.released && wave.release == null)) {
                    waves[index] = wave.copy(start = wave.start ?: frameTime, release = if (wave.released) wave.release ?: frameTime else null)
                }
            }
            waves.removeAll { wave -> wave.release?.let { end -> reduceMotion || frameTime > max((wave.start ?: frameTime) + 450_000_000L, end) + 150_000_000L } ?: false }
        }
    }
    val metrics = remember(p.str("size"), p.num("density"), p.str("variant")) { NativeButtonMetrics(p.str("size","sm"), p.num("density"), p.str("variant","filled")) }
    val palette = NativeButtonPalette.resolve(p.str("variant","filled"), p.bool("toggle"), selected, !p.enabled())
    val motion = !reduceMotion && !palette.disabled
    val radius by animateFloatAsState(metrics.radius(p.str("shape") == "square", p.bool("shapeMorph",true), selected, pressed), tween(if(!motion) 0 else if(pressed) 200 else 400, easing = if(pressed) Standard else Release), label = "source button radius")
    val connected = p.bool("connectedLeft") || p.bool("connectedRight")
    val leading = if(connected) { if(p.bool("connectedLeft") || p.str("shape") == "square") metrics.connectedRadius else metrics.roundRadius } else radius
    val trailing = if(connected) { if(p.bool("connectedRight") || p.str("shape") == "square") metrics.connectedRadius else metrics.roundRadius } else radius
    val shape = RoundedCornerShape(topStart = leading.dp, topEnd = trailing.dp, bottomEnd = trailing.dp, bottomStart = leading.dp)
    val colorDuration = if(!motion) 0 else if(pressed && p.bool("shapeMorph",true)) 200 else 100
    val container by animateColorAsState(roleColor(palette.container).copy(alpha = if(palette.container == null) 0f else if(palette.disabled) .12f else 1f), tween(colorDuration, easing=Standard), label="source button container")
    val label by animateColorAsState(roleColor(palette.label).copy(alpha = if(palette.disabled) .38f else 1f), tween(colorDuration, easing=Standard), label="source button label")
    val outline by animateColorAsState(roleColor(if(enabled && (hovered || focused) && palette.outline == "outline") "primary" else palette.outline).copy(alpha = if(palette.outline == null) 0f else if(palette.disabled) .12f else 1f), tween(colorDuration, easing=Standard), label="source button outline")
    val opacity by animateFloatAsState(if(!enabled) 0f else if(pressed || focused) .12f else if(hovered) .08f else 0f, tween(if(!motion) 0 else if(pressed) 50 else 100, easing=if(pressed) Release else Standard), label="source button state layer")
    val stateColor = roleColor(palette.label)
    val elevation by animateDpAsState((if(enabled && hovered && !pressed && !focused) palette.hoverElevation else palette.elevation).dp, tween(colorDuration, easing=Standard), label="source button elevation")
    val focusColor = MaterialTheme.colorScheme.secondary
    val click: () -> Unit = {
        performNativeButtonAction(p, selected, emit, action, form, router, p.bool("toggle") || group != null) { proposed ->
            localSelected = group?.toggle(identity) ?: proposed
            localSelected
        }
    }
    val textStyle = TextStyle(fontFamily = ButtonFonts, fontSize = metrics.fontSize.sp, fontWeight = FontWeight(metrics.weight), lineHeight = metrics.lineHeight.sp, letterSpacing = metrics.tracking.sp, platformStyle = PlatformTextStyle(includeFontPadding = false))
    CompositionLocalProvider(LocalContentColor provides label) {
        ProvideTextStyle(textStyle) {
            Box((if(p.bool("fullWidth")) Modifier.fillMaxWidth() else Modifier)
                .shadow(elevation, shape, clip=false)
                .drawBehind { if(focused && enabled) { val focusPath = shape.createOutline(size,layoutDirection,this); drawOutline(focusPath,focusColor,style=Stroke(7.dp.toPx())) } }
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
                .then(if(p.str("variant") == "outlined") Modifier.border(1.dp,outline,shape) else Modifier)
                .clickable(interactionSource=interactions, indication=null, enabled=enabled, role=Role.Button, onClick=click)
                .semantics { if(p.bool("toggle")) this.selected=selected }
                .sizeIn(minWidth=metrics.minimumWidth.dp,minHeight=metrics.height.dp)
                .padding(horizontal=metrics.padding.dp), contentAlignment=Alignment.Center) {
                ButtonSlotRow(metrics.gap.dp, metrics.lineHeight.dp) {
                    ButtonSlot("leading-icon", slot, slots) { if(p.str("icon").isNotBlank()) ButtonGlyph(p.str("icon"),metrics.icon,p.bool("mirrorIcon"),false) }
                    ButtonSlot("", slot, slots) { if(p.label().isNotBlank()) Text(p.label(),maxLines=1,overflow=TextOverflow.Clip) }
                    ButtonSlot("trailing-icon", slot, slots) { if(p.str("trailingIcon").isNotBlank()) ButtonGlyph(p.str("trailingIcon"),metrics.icon,p.bool("mirrorIcon"),p.bool("aria-expanded") && !p.bool("suppressExpandIconFlip")) }
                    if(p.bool("loading")) ButtonSlot("loader",slot, slots) { NativeButtonLoading(metrics.loading.dp,label,reduceMotion) }
                }
            }
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
        Text(name,fontFamily=SymbolFont,fontWeight=FontWeight.Normal,fontSize=size.sp,lineHeight=size.sp,letterSpacing=0.sp,maxLines=1,softWrap=false,
            style=TextStyle(platformStyle=PlatformTextStyle(includeFontPadding=false),fontFeatureSettings="liga"))
    }
}
