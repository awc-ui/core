package dev.awc.nativeui

import androidx.compose.runtime.*

/** The nine md-icon-button CSS hooks expressed as native colors and dp dimensions. */
@Immutable
data class AWCIconButtonAppearance(
    val containerColor: String? = null,
    val iconColor: String? = null,
    val stateLayerColor: String? = null,
    val iconSize: Double? = null,
    val cornerRadius: Double? = null,
    val outlineColor: String? = null,
    val outlineWidth: Double? = null,
    val width: Double? = null,
    val height: Double? = null,
) {
    val values: Map<String, AWCValue> get() = mapOf(
        "containerColor" to containerColor, "iconColor" to iconColor, "stateLayerColor" to stateLayerColor,
        "iconSize" to iconSize, "cornerRadius" to cornerRadius, "outlineColor" to outlineColor,
        "outlineWidth" to outlineWidth, "width" to width, "height" to height,
    ).filterValues { it != null }
    fun normalized() = fromValues(values)
    fun merged(local: AWCIconButtonAppearance) = fromValues(normalized().values + local.normalized().values)
    companion object {
        fun fromValues(values: Map<String, AWCValue>): AWCIconButtonAppearance {
            fun color(key: String) = (values[key] as? String)?.takeIf { it.matches(Regex("#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?")) }?.uppercase(java.util.Locale.ROOT)
            fun number(key: String, max: Double = 2400.0) = (values[key] as? Number)?.toDouble()?.takeIf { it.isFinite() && it in 0.0..max }
            return AWCIconButtonAppearance(color("containerColor"), color("iconColor"), color("stateLayerColor"),
                number("iconSize"), number("cornerRadius"), color("outlineColor"), number("outlineWidth",16.0), number("width"), number("height"))
        }
    }
}
internal val LocalAWCIconButtonAppearance = staticCompositionLocalOf { AWCIconButtonAppearance() }
@Composable
fun AWCIconButtonAppearanceScope(appearance: AWCIconButtonAppearance, content: @Composable () -> Unit) {
    val inherited = LocalAWCIconButtonAppearance.current
    val resolved = remember(inherited, appearance) { inherited.merged(appearance) }
    CompositionLocalProvider(LocalAWCIconButtonAppearance provides resolved, content = content)
}
