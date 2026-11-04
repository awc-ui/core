package dev.awc.nativeui

import androidx.compose.runtime.*

private fun skeletonColor(value:Any?)=(value as? String)?.takeIf { it.matches(Regex("#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?")) }?.uppercase(java.util.Locale.ROOT)
private fun skeletonDuration(value:Any?)=(value as? Number)?.toDouble()?.takeIf { it.isFinite() && it>=0 }

/** The eleven source appearance hooks. Durations use seconds; lengths retain
 * parent/font-relative units and physical corner shapes retain percentages. */
@Immutable data class AWCSkeletonAppearance(
    val color:String?=null,val highlight:String?=null,val radius:AWCCornerShape?=null,
    val roundedRadius:AWCCornerShape?=null,val width:AWCSkeletonLength?=null,
    val height:AWCSkeletonLength?=null,val size:AWCSkeletonLength?=null,
    val lineGap:AWCSkeletonLength?=null,val pulseDuration:Double?=null,
    val waveDuration:Double?=null,val bloomDuration:Double?=null,
) {
    val values:Map<String,AWCValue> get()=mapOf("color" to color,"highlight" to highlight,"radius" to radius?.values,
        "roundedRadius" to roundedRadius?.values,"width" to width?.values,"height" to height?.values,"size" to size?.values,
        "lineGap" to lineGap?.values,"pulseDuration" to pulseDuration,"waveDuration" to waveDuration,
        "bloomDuration" to bloomDuration).filterValues { it!=null }
    fun normalized()=fromValues(values)
    fun merged(local:AWCSkeletonAppearance)=fromValues(normalized().values+local.normalized().values)
    companion object {
        fun fromValues(values:Map<String,AWCValue>)=AWCSkeletonAppearance(
            skeletonColor(values["color"]),skeletonColor(values["highlight"]),
            AWCCornerShape.fromValues(values["radius"]),AWCCornerShape.fromValues(values["roundedRadius"]),
            AWCSkeletonLength.fromValues(values["width"]),AWCSkeletonLength.fromValues(values["height"]),
            AWCSkeletonLength.fromValues(values["size"]),AWCSkeletonLength.fromValues(values["lineGap"]),
            skeletonDuration(values["pulseDuration"]),skeletonDuration(values["waveDuration"]),skeletonDuration(values["bloomDuration"]))
    }
}
internal val LocalAWCSkeletonAppearance=staticCompositionLocalOf { AWCSkeletonAppearance() }
@Composable fun AWCSkeletonAppearanceScope(appearance:AWCSkeletonAppearance,content:@Composable ()->Unit) {
    val inherited=LocalAWCSkeletonAppearance.current
    val resolved=remember(inherited,appearance) { inherited.merged(appearance) }
    CompositionLocalProvider(LocalAWCSkeletonAppearance provides resolved,content=content)
}

enum class AWCSkeletonPart { Shape, Line, LineLast }
/** Actual painted part overrides. LineLast cascades after Line on the tapered
 * final row; it does not alter all the other rows. */
@Immutable data class AWCSkeletonPartAppearance(
    val color:String?=null,val width:AWCSkeletonLength?=null,
    val height:AWCSkeletonLength?=null,val cornerShape:AWCCornerShape?=null,
) {
    internal fun merged(local:AWCSkeletonPartAppearance)=AWCSkeletonPartAppearance(
        skeletonColor(local.color) ?: skeletonColor(color),local.width ?: width,
        local.height ?: height,local.cornerShape ?: cornerShape)
}
internal val LocalAWCSkeletonParts=staticCompositionLocalOf { emptyMap<AWCSkeletonPart,AWCSkeletonPartAppearance>() }
@Composable fun AWCSkeletonPartAppearanceScope(
    appearance:AWCSkeletonPartAppearance,part:AWCSkeletonPart=AWCSkeletonPart.Shape,content:@Composable ()->Unit,
) {
    val inherited=LocalAWCSkeletonParts.current
    CompositionLocalProvider(LocalAWCSkeletonParts provides (inherited+
        (part to (inherited[part] ?: AWCSkeletonPartAppearance()).merged(appearance))),content=content)
}
