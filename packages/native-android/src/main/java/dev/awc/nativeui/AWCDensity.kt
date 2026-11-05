package dev.awc.nativeui

import androidx.compose.runtime.*

/** Source local negative rungs override the inherited density token; zero inherits. */
internal fun resolveAWCDensity(value: AWCValue?, inherited: Double): Double =
    (value as? Number)?.toDouble()?.takeIf { it in listOf(-1.0, -2.0, -3.0, -4.0) }
        ?: inherited.takeIf { it.isFinite() } ?: 0.0

internal val LocalAWCNativeDensity = staticCompositionLocalOf { 0.0 }

/** Supply the inherited source density token to native descendants. */
@Composable
fun AWCDensityScope(density: Double, content: @Composable () -> Unit) {
    CompositionLocalProvider(LocalAWCNativeDensity provides density.takeIf { it.isFinite() }.let { it ?: 0.0 },
        LocalAWCDensityRungs provides (listOfNotNull(density.takeIf { it in listOf(-1.0, -2.0, -3.0, -4.0) }) + LocalAWCDensityRungs.current),
        content = content)
}


/**
 * md3.css spacing tokens per density rung (`[data-density]` / `[density]` rules; -1 redefines only row-height).
 * Rungs are nearest first (the element's own, then each ancestor's): the nearest rung that defines a token wins, else the
 * `:root` default — the CSS cascade of custom properties (gate-7 R4-02).
 */
internal object AWCSpacingTokens {
    private val table = mapOf(
        -1.0 to mapOf("row-height" to 52.0),
        -2.0 to mapOf("row-height" to 48.0, "inset-md" to 8.0, "inset-lg" to 12.0, "inset-xl" to 20.0, "gap-md" to 8.0, "gap-lg" to 12.0),
        -3.0 to mapOf("row-height" to 44.0, "inset-sm" to 4.0, "inset-md" to 8.0, "inset-lg" to 12.0, "inset-xl" to 16.0, "gap-sm" to 4.0, "gap-md" to 8.0, "gap-lg" to 12.0),
        -4.0 to mapOf("row-height" to 40.0, "inset-sm" to 4.0, "inset-md" to 8.0, "inset-lg" to 8.0, "inset-xl" to 16.0, "gap-xs" to 2.0, "gap-sm" to 4.0, "gap-md" to 4.0, "gap-lg" to 8.0))
    private val defaults = mapOf("row-height" to 56.0, "inset-xs" to 4.0, "inset-sm" to 8.0, "inset-md" to 12.0, "inset-lg" to 16.0, "inset-xl" to 24.0,
        "gap-xs" to 4.0, "gap-sm" to 8.0, "gap-md" to 12.0, "gap-lg" to 16.0)
    fun token(name: String, nearestFirst: List<Double>): Double = nearestFirst.firstNotNullOfOrNull { table[it]?.get(name) } ?: defaults[name] ?: 0.0
}
