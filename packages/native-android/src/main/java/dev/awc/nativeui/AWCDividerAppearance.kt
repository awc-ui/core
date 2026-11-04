package dev.awc.nativeui

import androidx.compose.runtime.*

/** The four public md-divider style hooks. Lengths are density-independent pixels. */
@Immutable
data class AWCDividerAppearance(
    val color: String? = null,
    val thickness: Double? = null,
    val insetStart: Double? = null,
    val insetEnd: Double? = null,
) {
    val values: Map<String, AWCValue> get() = mapOf(
        "color" to color, "thickness" to thickness, "insetStart" to insetStart, "insetEnd" to insetEnd
    ).filterValues { it != null }
    fun normalized() = fromValues(values)
    fun merged(local: AWCDividerAppearance) = fromValues(normalized().values + local.normalized().values)

    companion object {
        fun fromValues(values: Map<String, AWCValue>): AWCDividerAppearance {
            fun length(key: String) = (values[key] as? Number)?.toDouble()?.takeIf { it.isFinite() }
            return AWCDividerAppearance(
                (values["color"] as? String)?.takeIf { it.matches(Regex("#[0-9a-fA-F]{6}")) }?.uppercase(java.util.Locale.ROOT),
                length("thickness")?.takeIf { it >= 0 }, length("insetStart"), length("insetEnd")
            )
        }
    }
}
internal val LocalAWCDividerAppearance = staticCompositionLocalOf { AWCDividerAppearance() }

@Composable
fun AWCDividerAppearanceScope(appearance: AWCDividerAppearance, content: @Composable () -> Unit) {
    val inherited = LocalAWCDividerAppearance.current
    val resolved = remember(inherited, appearance) { inherited.merged(appearance) }
    CompositionLocalProvider(LocalAWCDividerAppearance provides resolved, content = content)
}
