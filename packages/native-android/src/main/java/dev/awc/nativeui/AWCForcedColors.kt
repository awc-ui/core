package dev.awc.nativeui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.layout
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.offset
import kotlin.math.roundToInt

/**
 * CSS `@media (forced-colors: active)` system colours for md-divider, md-avatar, md-card, md-dialog and md-accordion(+item).
 * Android has no forced-palette mode: hosts opt in with `AWCAccessibilityAppearanceScope(forcedColors = true)` (and may
 * supply their own palette with [AWCForcedColorPaletteScope]); [standard] is Chrome's forced palette (Chrome 153).
 */
data class AWCForcedColorPalette(val canvas:String,val canvasText:String,val buttonFace:String,val buttonText:String,val buttonBorder:String,
                                 val grayText:String,val highlight:String,val highlightText:String,val linkText:String) {
    /** The UA's forced background: Canvas keeping the authored alpha. */
    internal fun canvasKeepingAlphaOf(hex:String):String { val h=hex.removePrefix("#");val a=if(h.length==8) h.substring(6,8) else "FF";return canvas.take(7)+a.uppercase() }
    companion object {
        val standard=AWCForcedColorPalette(canvas="#000000",canvasText="#FFFFFF",buttonFace="#000000",buttonText="#FFFFFF",buttonBorder="#FFFFFF",
            grayText="#3FF23F",highlight="#00E6FFCC",highlightText="#000000",linkText="#FFFF00")
    }
}
internal val LocalAWCForcedColorPalette=staticCompositionLocalOf { AWCForcedColorPalette.standard }
@Composable fun AWCForcedColorPaletteScope(palette:AWCForcedColorPalette,content:@Composable ()->Unit)=
    CompositionLocalProvider(LocalAWCForcedColorPalette provides palette,content=content)
/** The forced palette when `forced-colors: active` applies here, else null. */
@Composable internal fun awcForcedColors():AWCForcedColorPalette?=
    if(LocalAWCAccessibilityAppearance.current.forcedColors==true) LocalAWCForcedColorPalette.current else null

private fun forcedRole(role:String,p:AWCForcedColorPalette):String =
    if(role=="secondary") p.highlight
    else if(role.startsWith("on-") || role.startsWith("inverse-on-") || role.startsWith("outline") ||
        role in setOf("primary","tertiary","error","inverse-primary","primary-fixed-dim","secondary-fixed-dim","tertiary-fixed-dim")) p.canvasText
    else p.canvas

/**
 * md-accordion(+item) under forced colours: the subtree's colour roles become the system colours the UA forces them to
 * (foreground roles CanvasText, backgrounds Canvas, `secondary` — the focus rings, `outline-color: Highlight` in the
 * source — Highlight) and elevation shadows none. No-op when [palette] is null.
 */
@Composable internal fun AWCForcedColorScope(palette:AWCForcedColorPalette?,content:@Composable ()->Unit) {
    if(palette==null) { content();return }
    val tokens=LocalAWCThemeTokens.current.mapValues { (k,v)-> if(k.startsWith("--md-sys-color-")) forcedRole(k.removePrefix("--md-sys-color-"),palette) else if(k.startsWith("--md-sys-elevation-")) "none" else v }
    val ink=awcColor(palette.canvasText,Color.White);val bg=awcColor(palette.canvas,Color.Black);val hi=awcColor(palette.highlight,Color.Cyan)
    val scheme=androidx.compose.material3.MaterialTheme.colorScheme.copy(primary=ink,onPrimary=ink,primaryContainer=bg,onPrimaryContainer=ink,inversePrimary=ink,
        secondary=hi,onSecondary=ink,secondaryContainer=bg,onSecondaryContainer=ink,tertiary=ink,onTertiary=ink,tertiaryContainer=bg,onTertiaryContainer=ink,
        background=bg,onBackground=ink,surface=bg,onSurface=ink,surfaceVariant=bg,onSurfaceVariant=ink,surfaceTint=bg,inverseSurface=bg,inverseOnSurface=ink,
        error=ink,onError=ink,errorContainer=bg,onErrorContainer=ink,outline=ink,outlineVariant=ink,scrim=bg,surfaceBright=bg,surfaceContainer=bg,
        surfaceContainerHigh=bg,surfaceContainerHighest=bg,surfaceContainerLow=bg,surfaceContainerLowest=bg,surfaceDim=bg)
    androidx.compose.material3.MaterialTheme(colorScheme=scheme,shapes=androidx.compose.material3.MaterialTheme.shapes,typography=androidx.compose.material3.MaterialTheme.typography) {
        CompositionLocalProvider(LocalAWCThemeTokens provides tokens,content=content)
    }
}

/** A border-box inset of [width] on every side (the forced-colors host borders): the two sides' total is rounded once, as the
 * CSS border box is, instead of rounding each side (no extra fraction of a dp per border). */
internal fun Modifier.awcBorderInset(width:Dp):Modifier=layout { m,c->
    val total=(width.toPx()*2).roundToInt();val start=width.toPx().roundToInt().coerceAtMost(total)
    val inner=m.measure(c.offset(-total,-total))
    layout(inner.width+total,inner.height+total) { inner.place(start,start) }
}
