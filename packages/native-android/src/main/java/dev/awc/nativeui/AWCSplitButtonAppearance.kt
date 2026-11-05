package dev.awc.nativeui

import androidx.compose.runtime.*

/** Six public Split Button hooks. Lengths are density-independent pixels. */
@Immutable
data class AWCSplitButtonAppearance(
    val containerColor: String? = null, val labelColor: String? = null,
    val iconColor: String? = null, val outlineColor: String? = null,
    val cornerRadius: Double? = null, val iconSize: Double? = null,
) {
    val values: Map<String, AWCValue> get() = mapOf("containerColor" to containerColor,
        "labelColor" to labelColor, "iconColor" to iconColor, "outlineColor" to outlineColor,
        "cornerRadius" to cornerRadius, "iconSize" to iconSize).filterValues { it != null }
    fun normalized() = fromValues(values)
    fun merged(local: AWCSplitButtonAppearance) = fromValues(normalized().values + local.normalized().values)
    companion object {
        fun fromValues(values: Map<String, AWCValue>): AWCSplitButtonAppearance {
            fun color(key: String) = (values[key] as? String)?.takeIf { it.matches(Regex("#[0-9a-fA-F]{6}")) }?.uppercase(java.util.Locale.ROOT)
            fun length(key: String) = (values[key] as? Number)?.toDouble()?.takeIf { it.isFinite() && it in 0.0..2400.0 }
            return AWCSplitButtonAppearance(color("containerColor"), color("labelColor"), color("iconColor"),
                color("outlineColor"), length("cornerRadius"), length("iconSize"))
        }
    }
}
internal val LocalAWCSplitButtonAppearance = staticCompositionLocalOf { AWCSplitButtonAppearance() }
@Composable
fun AWCSplitButtonAppearanceScope(appearance: AWCSplitButtonAppearance, content: @Composable () -> Unit) {
    val inherited = LocalAWCSplitButtonAppearance.current
    val resolved = remember(inherited, appearance) { inherited.merged(appearance) }
    CompositionLocalProvider(LocalAWCSplitButtonAppearance provides resolved, content = content)
}

/** Observe the actual trailing toggle state without introducing a source component method. */
@Stable
class AWCSplitButtonState {
    private var owner: Any? = null
    private var read: (() -> Boolean)? = null
    fun snapshot(): Boolean? = read?.invoke()
    internal fun bind(identity: Any, reader: () -> Boolean) { owner = identity; read = reader }
    internal fun unbind(identity: Any) { if (owner === identity) { owner = null; read = null } }
}
internal val LocalAWCSplitButtonState = staticCompositionLocalOf<AWCSplitButtonState?> { null }
@Composable
fun AWCSplitButtonStateScope(state: AWCSplitButtonState, content: @Composable () -> Unit) {
    CompositionLocalProvider(LocalAWCSplitButtonState provides state, content = content)
}

internal val LocalAWCSplitButtonShapeMorph = staticCompositionLocalOf { true }
/** Native counterpart of the source's inherited shape-morph enable token. */
@Composable
fun AWCSplitButtonShapeMorphScope(enabled: Boolean, content: @Composable () -> Unit) {
    CompositionLocalProvider(LocalAWCSplitButtonShapeMorph provides enabled, content = content)
}
