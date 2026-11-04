package dev.awc.nativeui

import androidx.compose.runtime.*

/** Public md-button-group layout hooks, expressed in density-independent pixels. */
@Immutable
data class AWCButtonGroupAppearance(
    val gap: Double? = null, val width: Double? = null, val minWidth: Double? = null,
    val maxWidth: Double? = null, val height: Double? = null, val minHeight: Double? = null,
    val maxHeight: Double? = null,
) {
    val values: Map<String, AWCValue> get() = mapOf("gap" to gap,"width" to width,"minWidth" to minWidth,
        "maxWidth" to maxWidth,"height" to height,"minHeight" to minHeight,"maxHeight" to maxHeight).filterValues { it != null }
    fun normalized() = fromValues(values)
    fun merged(local: AWCButtonGroupAppearance) = fromValues(normalized().values + local.normalized().values)
    companion object {
        fun fromValues(values: Map<String, AWCValue>): AWCButtonGroupAppearance {
            fun number(key: String) = (values[key] as? Number)?.toDouble()?.takeIf { it.isFinite() && it in 0.0..2400.0 }
            return AWCButtonGroupAppearance(number("gap"),number("width"),number("minWidth"),number("maxWidth"),number("height"),number("minHeight"),number("maxHeight"))
        }
    }
}
internal val LocalAWCButtonGroupAppearance = staticCompositionLocalOf { AWCButtonGroupAppearance() }
@Composable fun AWCButtonGroupAppearanceScope(appearance: AWCButtonGroupAppearance, content: @Composable () -> Unit) {
    val inherited=LocalAWCButtonGroupAppearance.current
    val resolved=remember(inherited,appearance) { inherited.merged(appearance) }
    CompositionLocalProvider(LocalAWCButtonGroupAppearance provides resolved,content=content)
}

/** An ordered, read-only snapshot of actual child selection, including duplicate values. */
@Stable class AWCButtonGroupState {
    private var current: List<Boolean> = emptyList()
    private var read: (() -> List<Boolean>)? = null
    private var owner: Any? = null
    fun snapshot(): List<Boolean> { read?.let { update(it()) }; return current }
    internal fun bind(identity: Any, reader: () -> List<Boolean>) { owner=identity;read=reader }
    internal fun unbind(identity: Any) { if(owner===identity) { owner=null;read=null;update(emptyList()) } }
    internal fun update(selection: List<Boolean>) { if(current!=selection) current=selection.toList() }
}
internal val LocalAWCButtonGroupState = staticCompositionLocalOf<AWCButtonGroupState?> { null }
@Composable fun AWCButtonGroupStateScope(state: AWCButtonGroupState, content: @Composable () -> Unit) {
    CompositionLocalProvider(LocalAWCButtonGroupState provides state,content=content)
}
