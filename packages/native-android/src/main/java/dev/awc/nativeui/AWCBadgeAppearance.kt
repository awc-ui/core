package dev.awc.nativeui

import androidx.compose.runtime.*

/** Translation in dp plus a fraction of the badge's own width or height. */
@Immutable
data class AWCBadgeOffset(val points: Double = 0.0, val fraction: Double = 0.0) {
    internal val valid get() = points.isFinite() && fraction.isFinite()
    internal fun resolved(length: Double) = points + fraction * length
    internal val values get() = mapOf("points" to points, "fraction" to fraction)
}

/** Physical sides, in the same order as CSS padding shorthand. */
@Immutable
data class AWCBadgePadding(val top: Double = 0.0, val right: Double = 0.0, val bottom: Double = 0.0, val left: Double = 0.0) {
    internal val values get() = listOf(top, right, bottom, left)
    internal val valid get() = values.all { it.isFinite() && it >= 0.0 }
}

/** The ten public md-badge style hooks, using resolved native lengths. */
@Immutable
data class AWCBadgeAppearance(
    val containerColor: String? = null,
    val labelColor: String? = null,
    val cornerRadius: Double? = null,
    val iconColor: String? = null,
    val iconSize: Double? = null,
    val offsetX: AWCBadgeOffset? = null,
    val offsetY: AWCBadgeOffset? = null,
    val largeHeight: Double? = null,
    val largePadding: AWCBadgePadding? = null,
    val smallSize: Double? = null,
) {
    val values: Map<String, AWCValue> get() = mapOf(
        "containerColor" to containerColor, "labelColor" to labelColor, "cornerRadius" to cornerRadius,
        "iconColor" to iconColor, "iconSize" to iconSize, "offsetX" to offsetX?.values, "offsetY" to offsetY?.values,
        "largeHeight" to largeHeight, "largePadding" to largePadding?.values, "smallSize" to smallSize
    ).filterValues { it != null }
    fun normalized() = fromValues(values)
    fun merged(local: AWCBadgeAppearance) = fromValues(normalized().values + local.normalized().values)

    companion object {
        fun fromValues(values: Map<String, AWCValue>): AWCBadgeAppearance {
            fun number(value: Any?) = (value as? Number)?.toDouble()?.takeIf { it.isFinite() }
            fun length(key: String) = number(values[key])?.takeIf { it >= 0 }
            fun color(key: String) = (values[key] as? String)
                ?.takeIf { it.matches(Regex("#[0-9a-fA-F]{6}")) }?.uppercase(java.util.Locale.ROOT)
            fun offset(key: String): AWCBadgeOffset? {
                val map = values[key] as? Map<*, *> ?: return null
                if (map.keys.any { it !in setOf("points", "fraction") }) return null
                val points = if (map.containsKey("points")) number(map["points"]) ?: return null else 0.0
                val fraction = if (map.containsKey("fraction")) number(map["fraction"]) ?: return null else 0.0
                return AWCBadgeOffset(points, fraction)
            }
            val padding = (values["largePadding"] as? List<*>)?.takeIf { it.size == 4 }?.let { array ->
                val numbers = array.mapNotNull { number(it)?.takeIf { value -> value >= 0 } }
                if (numbers.size == 4) AWCBadgePadding(numbers[0], numbers[1], numbers[2], numbers[3]) else null
            }
            return AWCBadgeAppearance(color("containerColor"), color("labelColor"), length("cornerRadius"),
                color("iconColor"), length("iconSize"), offset("offsetX"), offset("offsetY"),
                length("largeHeight"), padding, length("smallSize"))
        }
    }
}

internal val LocalAWCBadgeAppearance = staticCompositionLocalOf { AWCBadgeAppearance() }

@Composable
fun AWCBadgeAppearanceScope(appearance: AWCBadgeAppearance, content: @Composable () -> Unit) {
    val inherited = LocalAWCBadgeAppearance.current
    val resolved = remember(inherited, appearance) { inherited.merged(appearance) }
    CompositionLocalProvider(LocalAWCBadgeAppearance provides resolved, content = content)
}
