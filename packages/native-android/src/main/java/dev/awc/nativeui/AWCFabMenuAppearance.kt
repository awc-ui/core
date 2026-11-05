package dev.awc.nativeui

import androidx.compose.runtime.*

private fun fabMenuColor(values: Map<String, AWCValue>, key: String) =
    (values[key] as? String)?.takeIf { it.matches(Regex("#[0-9a-fA-F]{6}")) }?.uppercase(java.util.Locale.ROOT)
private fun fabMenuLength(values: Map<String, AWCValue>, key: String) =
    (values[key] as? Number)?.toDouble()?.takeIf { it.isFinite() && it in 0.0..2400.0 }

/** The three public FAB menu hooks. Lengths use dp. */
@Immutable
data class AWCFabMenuAppearance(
    val itemContainerColor: String? = null,
    val itemLabelColor: String? = null,
    val itemGap: Double? = null,
) {
    val values: Map<String, AWCValue> get() = mapOf("itemContainerColor" to itemContainerColor,
        "itemLabelColor" to itemLabelColor, "itemGap" to itemGap).filterValues { it != null }
    fun normalized() = fromValues(values)
    fun merged(other: AWCFabMenuAppearance) = fromValues(normalized().values + other.normalized().values)
    companion object {
        fun fromValues(values: Map<String, AWCValue>) = AWCFabMenuAppearance(
            fabMenuColor(values,"itemContainerColor"),fabMenuColor(values,"itemLabelColor"),fabMenuLength(values,"itemGap"))
    }
}

/** The five public FAB menu item hooks. Lengths use dp. */
@Immutable
data class AWCFabMenuItemAppearance(
    val containerColor: String? = null,
    val labelColor: String? = null,
    val iconColor: String? = null,
    val iconSize: Double? = null,
    val cornerRadius: Double? = null,
) {
    val values: Map<String, AWCValue> get() = mapOf("containerColor" to containerColor,
        "labelColor" to labelColor, "iconColor" to iconColor, "iconSize" to iconSize,
        "cornerRadius" to cornerRadius).filterValues { it != null }
    fun normalized() = fromValues(values)
    fun merged(other: AWCFabMenuItemAppearance) = fromValues(normalized().values + other.normalized().values)
    companion object {
        fun fromValues(values: Map<String, AWCValue>) = AWCFabMenuItemAppearance(
            fabMenuColor(values,"containerColor"),fabMenuColor(values,"labelColor"),
            fabMenuColor(values,"iconColor"),fabMenuLength(values,"iconSize"),fabMenuLength(values,"cornerRadius"))
    }
}

internal val LocalAWCFabMenuAppearance = staticCompositionLocalOf { AWCFabMenuAppearance() }
internal val LocalAWCFabMenuItemAppearance = staticCompositionLocalOf { AWCFabMenuItemAppearance() }

@Composable
fun AWCFabMenuAppearanceScope(appearance: AWCFabMenuAppearance, content: @Composable () -> Unit) {
    val inherited=LocalAWCFabMenuAppearance.current
    val resolved=remember(inherited,appearance) { inherited.merged(appearance) }
    CompositionLocalProvider(LocalAWCFabMenuAppearance provides resolved,content=content)
}

@Composable
fun AWCFabMenuItemAppearanceScope(appearance: AWCFabMenuItemAppearance, content: @Composable () -> Unit) {
    val inherited=LocalAWCFabMenuItemAppearance.current
    val resolved=remember(inherited,appearance) { inherited.merged(appearance) }
    CompositionLocalProvider(LocalAWCFabMenuItemAppearance provides resolved,content=content)
}
