package dev.awc.nativeui

import androidx.compose.runtime.*

/** The seven public segmented-button hooks. Lengths are density-independent pixels. */
@Immutable
data class AWCSegmentedButtonAppearance(
    val containerColor: String? = null, val selectedContainerColor: String? = null,
    val labelColor: String? = null, val selectedLabelColor: String? = null,
    val outlineColor: String? = null, val cornerRadius: Double? = null, val iconSize: Double? = null,
) {
    val values: Map<String,AWCValue> get() = mapOf("containerColor" to containerColor,"selectedContainerColor" to selectedContainerColor,
        "labelColor" to labelColor,"selectedLabelColor" to selectedLabelColor,"outlineColor" to outlineColor,
        "cornerRadius" to cornerRadius,"iconSize" to iconSize).filterValues { it!=null }
    fun normalized()=fromValues(values)
    fun merged(local:AWCSegmentedButtonAppearance)=fromValues(normalized().values+local.normalized().values)
    companion object {
        fun fromValues(values:Map<String,AWCValue>):AWCSegmentedButtonAppearance {
            fun color(key:String)=(values[key] as? String)?.takeIf { it.matches(Regex("#[0-9a-fA-F]{6}")) }?.uppercase(java.util.Locale.ROOT)
            fun length(key:String)=(values[key] as? Number)?.toDouble()?.takeIf { it.isFinite() && it in 0.0..2400.0 }
            return AWCSegmentedButtonAppearance(color("containerColor"),color("selectedContainerColor"),color("labelColor"),
                color("selectedLabelColor"),color("outlineColor"),length("cornerRadius"),length("iconSize"))
        }
    }
}
internal val LocalAWCSegmentedButtonAppearance=staticCompositionLocalOf { AWCSegmentedButtonAppearance() }
@Composable fun AWCSegmentedButtonAppearanceScope(appearance:AWCSegmentedButtonAppearance,content:@Composable ()->Unit) {
    val inherited=LocalAWCSegmentedButtonAppearance.current
    val resolved=remember(inherited,appearance) { inherited.merged(appearance) }
    CompositionLocalProvider(LocalAWCSegmentedButtonAppearance provides resolved,content=content)
}

/** Read actual child selection in authored order; duplicate values retain their identities. */
@Stable class AWCSegmentedButtonSetState {
    private var owner:Any?=null
    private var reader:(()->List<Boolean>)?=null
    private var current=emptyList<Boolean>()
    fun snapshot():List<Boolean> { val next=reader?.invoke().orEmpty();if(next!=current) current=next.toList();return current }
    internal fun bind(identity:Any,read:()->List<Boolean>) { owner=identity;reader=read }
    internal fun unbind(identity:Any) { if(owner===identity) { owner=null;reader=null;current=emptyList() } }
}
internal val LocalAWCSegmentedButtonSetState=staticCompositionLocalOf<AWCSegmentedButtonSetState?> { null }
@Composable fun AWCSegmentedButtonSetStateScope(state:AWCSegmentedButtonSetState,content:@Composable ()->Unit) {
    CompositionLocalProvider(LocalAWCSegmentedButtonSetState provides state,content=content)
}

/** Exact ordered source array for a scoped segmented-set change, including duplicate/empty values. */
val AWCActionEvent.segmentedSelectionValues:List<String>?
    get() = if(tag=="md-segmented-button-set" && name=="mdChange" && rawDetail is List<*> && rawDetail.all { it is String })
        rawDetail.map { it as String } else null
