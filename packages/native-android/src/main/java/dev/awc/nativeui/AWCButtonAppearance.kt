package dev.awc.nativeui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.remember
import androidx.compose.runtime.staticCompositionLocalOf

/**
 * Shared native md-button appearance. Colors are #RRGGBB or #RRGGBBAA; dimensions are dp
 * (typography is sp). Null or invalid fields inherit the surrounding scope.
 * Numeric fields use Double for the same JSON-shaped API as generated props.
 */
@Immutable
data class AWCButtonAppearance(
    val containerColor: String? = null,
    val labelColor: String? = null,
    val iconColor: String? = null,
    val trailingIconColor: String? = null,
    val loadingColor: String? = null,
    val stateLayerColor: String? = null,
    val outlineColor: String? = null,
    val focusRingColor: String? = null,
    val iconSize: Double? = null,
    val trailingIconSize: Double? = null,
    val loadingSize: Double? = null,
    val fontSize: Double? = null,
    val fontWeight: Double? = null,
    val lineHeight: Double? = null,
    val letterSpacing: Double? = null,
    val cornerRadius: Double? = null,
    val outlineWidth: Double? = null,
    val paddingInline: Double? = null,
    val paddingBlock: Double? = null,
    val gap: Double? = null,
    val hoverOpacity: Double? = null,
    val focusOpacity: Double? = null,
    val pressedOpacity: Double? = null,
    val width: Double? = null,
    val minWidth: Double? = null,
    val maxWidth: Double? = null,
    val height: Double? = null,
    val minHeight: Double? = null,
    /** Fixed state-layer opacity in every enabled state (the source `::part(state-layer) { opacity }` rule). */
    val stateLayerOpacity: Double? = null,
) {
    val values: Map<String, AWCValue> get() = mapOf(
        "containerColor" to containerColor,
        "labelColor" to labelColor,
        "iconColor" to iconColor,
        "trailingIconColor" to trailingIconColor,
        "loadingColor" to loadingColor,
        "stateLayerColor" to stateLayerColor,
        "outlineColor" to outlineColor,
        "focusRingColor" to focusRingColor,
        "iconSize" to iconSize,
        "trailingIconSize" to trailingIconSize,
        "loadingSize" to loadingSize,
        "fontSize" to fontSize,
        "fontWeight" to fontWeight,
        "lineHeight" to lineHeight,
        "letterSpacing" to letterSpacing,
        "cornerRadius" to cornerRadius,
        "outlineWidth" to outlineWidth,
        "paddingInline" to paddingInline,
        "paddingBlock" to paddingBlock,
        "gap" to gap,
        "hoverOpacity" to hoverOpacity,
        "focusOpacity" to focusOpacity,
        "pressedOpacity" to pressedOpacity,
        "width" to width,
        "minWidth" to minWidth,
        "maxWidth" to maxWidth,
        "height" to height,
        "minHeight" to minHeight,
        "stateLayerOpacity" to stateLayerOpacity,
    ).filterValues { it != null }

    /** Ignore malformed fields individually; never clamp them into a surprise style. */
    fun normalized(): AWCButtonAppearance = fromValues(values)

    /** Local valid fields replace inherited fields; omission and invalid values inherit. */
    fun merged(local: AWCButtonAppearance): AWCButtonAppearance =
        fromValues(normalized().values + local.normalized().values)

    companion object {
        fun fromValues(values: Map<String, AWCValue>): AWCButtonAppearance {
            fun color(name: String): String? = (values[name] as? String)
                ?.takeIf { it.matches(Regex("#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?")) }?.uppercase(java.util.Locale.ROOT)
            fun number(name: String, minimum: Double, maximum: Double, integer: Boolean = false): Double? =
                (values[name] as? Number)?.toDouble()?.takeIf {
                    it.isFinite() && it in minimum..maximum && (!integer || it == kotlin.math.floor(it))
                }
            return AWCButtonAppearance(
                containerColor = color("containerColor"),
                labelColor = color("labelColor"),
                iconColor = color("iconColor"),
                trailingIconColor = color("trailingIconColor"),
                loadingColor = color("loadingColor"),
                stateLayerColor = color("stateLayerColor"),
                outlineColor = color("outlineColor"),
                focusRingColor = color("focusRingColor"),
                iconSize = number("iconSize", 8.0, 128.0),
                trailingIconSize = number("trailingIconSize", 8.0, 128.0),
                loadingSize = number("loadingSize", 8.0, 128.0),
                fontSize = number("fontSize", 8.0, 96.0),
                fontWeight = number("fontWeight", 100.0, 900.0, integer = true),
                lineHeight = number("lineHeight", 8.0, 160.0),
                letterSpacing = number("letterSpacing", -5.0, 20.0),
                cornerRadius = number("cornerRadius", 0.0, 200.0),
                outlineWidth = number("outlineWidth", 0.0, 16.0),
                paddingInline = number("paddingInline", 0.0, 128.0),
                paddingBlock = number("paddingBlock", 0.0, 128.0),
                gap = number("gap", 0.0, 64.0),
                hoverOpacity = number("hoverOpacity", 0.0, 1.0),
                focusOpacity = number("focusOpacity", 0.0, 1.0),
                pressedOpacity = number("pressedOpacity", 0.0, 1.0),
                width = number("width", 0.0, 2400.0),
                minWidth = number("minWidth", 0.0, 2400.0),
                maxWidth = number("maxWidth", 0.0, 2400.0),
                height = number("height", 0.0, 2400.0),
                minHeight = number("minHeight", 0.0, 2400.0),
                stateLayerOpacity = number("stateLayerOpacity", 0.0, 1.0),
            )
        }
    }
}

internal val LocalAWCButtonAppearance = staticCompositionLocalOf { AWCButtonAppearance() }

/** Apply defaults to an app subtree or override one generated AWCButton locally. */
@Composable
fun AWCButtonAppearanceScope(appearance: AWCButtonAppearance, content: @Composable () -> Unit) {
    val inherited = LocalAWCButtonAppearance.current
    val resolved = remember(inherited, appearance) { inherited.merged(appearance) }
    CompositionLocalProvider(LocalAWCButtonAppearance provides resolved, content = content)
}
