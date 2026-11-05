package dev.awc.nativeui

import androidx.compose.runtime.*

/** A logical inset in dp plus a fraction of the parent's corresponding dimension. */
@Immutable
data class AWCStatusDotInset(val points: Double = 0.0, val fraction: Double = 0.0) {
    internal fun resolved(dimension: Double) = points + dimension * fraction
    internal val values get() = mapOf("points" to points, "fraction" to fraction)
}

/** The eight md-status-dot hooks. Colors accept RGB/RGBA hex; duration uses seconds. */
@Immutable
data class AWCStatusDotAppearance(
    val size: Double? = null,
    val color: String? = null,
    val pulseColor: String? = null,
    val outlineColor: String? = null,
    val outlineWidth: Double? = null,
    val insetEnd: AWCStatusDotInset? = null,
    val insetBlockEnd: AWCStatusDotInset? = null,
    val pulseDuration: Double? = null,
) {
    val values: Map<String, AWCValue> get() = mapOf(
        "size" to size, "color" to color, "pulseColor" to pulseColor,
        "outlineColor" to outlineColor, "outlineWidth" to outlineWidth,
        "insetEnd" to insetEnd?.values, "insetBlockEnd" to insetBlockEnd?.values,
        "pulseDuration" to pulseDuration,
    ).filterValues { it != null }
    fun normalized() = fromValues(values)
    fun merged(local: AWCStatusDotAppearance) = fromValues(normalized().values + local.normalized().values)

    companion object {
        fun fromValues(values: Map<String, AWCValue>): AWCStatusDotAppearance {
            fun number(value: Any?) = (value as? Number)?.toDouble()?.takeIf { it.isFinite() }
            fun length(key: String) = number(values[key])?.takeIf { it >= 0 }
            fun color(key: String) = (values[key] as? String)
                ?.takeIf { it.matches(Regex("#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?")) }
                ?.uppercase(java.util.Locale.ROOT)
            fun inset(key: String): AWCStatusDotInset? {
                val map = values[key] as? Map<*, *> ?: return null
                if (map.keys.any { it !in setOf("points", "fraction") }) return null
                val points = if (map.containsKey("points")) number(map["points"]) ?: return null else 0.0
                val fraction = if (map.containsKey("fraction")) number(map["fraction"]) ?: return null else 0.0
                return AWCStatusDotInset(points, fraction)
            }
            return AWCStatusDotAppearance(length("size"), color("color"), color("pulseColor"),
                color("outlineColor"), length("outlineWidth"), inset("insetEnd"), inset("insetBlockEnd"),
                length("pulseDuration"))
        }
    }
}

internal val LocalAWCStatusDotAppearance = staticCompositionLocalOf { AWCStatusDotAppearance() }

@Composable
fun AWCStatusDotAppearanceScope(appearance: AWCStatusDotAppearance, content: @Composable () -> Unit) {
    val inherited = LocalAWCStatusDotAppearance.current
    val resolved = remember(inherited, appearance) { inherited.merged(appearance) }
    CompositionLocalProvider(LocalAWCStatusDotAppearance provides resolved, content = content)
}
