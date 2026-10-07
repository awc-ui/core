package dev.awc.nativeui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.awc.nativeui.generated.AWCGeneratedTokens

/** Maps generated source color and size tokens into native Material3 theme roles. */
@Composable
fun AWCTheme(darkTheme: Boolean = isSystemInDarkTheme(), content: @Composable () -> Unit) {
    val tokens = if(darkTheme) AWCGeneratedTokens.dark else AWCGeneratedTokens.light
    fun resolve(key: String, depth: Int = 0): String? {
        if(depth > 12) return null
        val raw = tokens[key] ?: tokens[key.removePrefix("--")] ?: return null
        if(!raw.startsWith("var(")) return raw
        val inner = raw.removePrefix("var(").removeSuffix(")")
        return resolve(inner.substringBefore(',').trim(), depth + 1) ?: inner.substringAfter(',', "").trim().ifEmpty { null }
    }
    fun color(role: String, fallback: Color): Color = resolve("--md-sys-color-$role")?.let { awcColor(it, fallback) } ?: fallback
    fun dimension(key: String, fallback: Float): Float {
        val value = resolve(key)?.trim() ?: return fallback
        return when { value.endsWith("rem") -> (value.removeSuffix("rem").toFloatOrNull() ?: return fallback) * 16f; value.endsWith("px") -> value.removeSuffix("px").toFloatOrNull() ?: fallback; else -> value.toFloatOrNull() ?: fallback }
    }
    val base = if(darkTheme) darkColorScheme() else lightColorScheme()
    val colors = base.copy(
        primary = color("primary", base.primary), onPrimary = color("on-primary", base.onPrimary), primaryContainer = color("primary-container", base.primaryContainer), onPrimaryContainer = color("on-primary-container", base.onPrimaryContainer),
        secondary = color("secondary", base.secondary), onSecondary = color("on-secondary", base.onSecondary), secondaryContainer = color("secondary-container", base.secondaryContainer), onSecondaryContainer = color("on-secondary-container", base.onSecondaryContainer),
        tertiary = color("tertiary", base.tertiary), onTertiary = color("on-tertiary", base.onTertiary), tertiaryContainer = color("tertiary-container", base.tertiaryContainer), onTertiaryContainer = color("on-tertiary-container", base.onTertiaryContainer),
        error = color("error", base.error), onError = color("on-error", base.onError), errorContainer = color("error-container", base.errorContainer), onErrorContainer = color("on-error-container", base.onErrorContainer),
        background = color("background", base.background), onBackground = color("on-background", base.onBackground), surface = color("surface", base.surface), onSurface = color("on-surface", base.onSurface), surfaceVariant = color("surface-variant", base.surfaceVariant), onSurfaceVariant = color("on-surface-variant", base.onSurfaceVariant),
        outline = color("outline", base.outline), outlineVariant = color("outline-variant", base.outlineVariant), inverseSurface = color("inverse-surface", base.inverseSurface), inverseOnSurface = color("inverse-on-surface", base.inverseOnSurface), inversePrimary = color("inverse-primary", base.inversePrimary), surfaceTint = color("surface-tint", base.surfaceTint), scrim = color("scrim", base.scrim),
        surfaceDim = color("surface-dim", base.surfaceDim), surfaceBright = color("surface-bright", base.surfaceBright), surfaceContainerLowest = color("surface-container-lowest", base.surfaceContainerLowest), surfaceContainerLow = color("surface-container-low", base.surfaceContainerLow), surfaceContainer = color("surface-container", base.surfaceContainer), surfaceContainerHigh = color("surface-container-high", base.surfaceContainerHigh), surfaceContainerHighest = color("surface-container-highest", base.surfaceContainerHighest),
    )
    val type = Typography()
    val typography = type.copy(
        bodyLarge = type.bodyLarge.copy(fontSize = dimension("--md-sys-typescale-body-large-font-size", 16f).sp),
        bodyMedium = type.bodyMedium.copy(fontSize = dimension("--md-sys-typescale-body-medium-font-size", 14f).sp),
        bodySmall = type.bodySmall.copy(fontSize = dimension("--md-sys-typescale-body-small-font-size", 12f).sp),
        titleLarge = type.titleLarge.copy(fontSize = dimension("--md-sys-typescale-title-large-font-size", 22f).sp),
        titleMedium = type.titleMedium.copy(fontSize = dimension("--md-sys-typescale-title-medium-font-size", 16f).sp),
        labelLarge = type.labelLarge.copy(fontSize = dimension("--md-sys-typescale-label-large-font-size", 14f).sp),
    )
    val shapes = Shapes(
        extraSmall = RoundedCornerShape(dimension("--md-sys-shape-corner-extra-small", 4f).dp),
        small = RoundedCornerShape(dimension("--md-sys-shape-corner-small", 8f).dp),
        medium = RoundedCornerShape(dimension("--md-sys-shape-corner-medium", 12f).dp),
        large = RoundedCornerShape(dimension("--md-sys-shape-corner-large", 16f).dp),
        extraLarge = RoundedCornerShape(dimension("--md-sys-shape-corner-extra-large", 28f).dp),
    )
    MaterialTheme(colorScheme = colors, shapes = shapes, typography = typography, content = content)
}
