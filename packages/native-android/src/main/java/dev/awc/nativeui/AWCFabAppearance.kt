package dev.awc.nativeui

import androidx.compose.runtime.*

/** The five public md-fab appearance hooks, with lengths in dp. */
@Immutable
data class AWCFabAppearance(
    val containerColor: String? = null,
    val iconColor: String? = null,
    val iconSize: Double? = null,
    val cornerRadius: Double? = null,
    val labelColor: String? = null,
) {
    val values: Map<String, AWCValue> get() = mapOf("containerColor" to containerColor,
        "iconColor" to iconColor, "iconSize" to iconSize, "cornerRadius" to cornerRadius,
        "labelColor" to labelColor).filterValues { it != null }
    fun normalized() = fromValues(values)
    fun merged(local: AWCFabAppearance) = fromValues(normalized().values + local.normalized().values)
    companion object {
        fun fromValues(values: Map<String, AWCValue>): AWCFabAppearance {
            fun color(key: String) = (values[key] as? String)?.takeIf { it.matches(Regex("#[0-9a-fA-F]{6}")) }?.uppercase(java.util.Locale.ROOT)
            fun length(key: String) = (values[key] as? Number)?.toDouble()?.takeIf { it.isFinite() && it in 0.0..2400.0 }
            return AWCFabAppearance(color("containerColor"), color("iconColor"), length("iconSize"), length("cornerRadius"), color("labelColor"))
        }
    }
}
internal val LocalAWCFabAppearance = staticCompositionLocalOf { AWCFabAppearance() }
@Composable
fun AWCFabAppearanceScope(appearance: AWCFabAppearance, content: @Composable () -> Unit) {
    val inherited = LocalAWCFabAppearance.current
    val resolved = remember(inherited, appearance) { inherited.merged(appearance) }
    CompositionLocalProvider(LocalAWCFabAppearance provides resolved, content = content)
}

/** A UI-thread controller for one attached FAB. Authored icon and slot content remain intact. */
@Stable
class AWCFabController {
    private var owner: Any? = null
    private var applyIcon: ((String?) -> Unit)? = null
    /** True means an attached FAB accepted the update; no animation completion is implied. */
    fun setMenuIcon(icon: String?): Boolean {
        val apply = applyIcon ?: return false
        apply(icon?.takeUnless { it.isEmpty() })
        return true
    }
    internal fun attach(identity: Any, apply: (String?) -> Unit) {
        check(owner == null || owner === identity) { "AWCFabControllerScope must contain one FAB." }
        owner = identity; applyIcon = apply
    }
    internal fun detach(identity: Any) {
        if (owner === identity) { owner = null; applyIcon = null }
    }
}
@Composable fun rememberAWCFabController(): AWCFabController = remember { AWCFabController() }
internal val LocalAWCFabController = staticCompositionLocalOf<AWCFabController?> { null }
@Composable
fun AWCFabControllerScope(controller: AWCFabController, content: @Composable () -> Unit) {
    CompositionLocalProvider(LocalAWCFabController provides controller, content = content)
}
