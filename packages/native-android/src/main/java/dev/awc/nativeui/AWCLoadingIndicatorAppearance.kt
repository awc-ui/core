package dev.awc.nativeui

import androidx.compose.runtime.*

private fun loadingLength(value:Any?)=(value as? Number)?.toDouble()?.takeIf { it.isFinite() && it>=0 }
private fun loadingColor(value:Any?)=(value as? String)?.takeIf { it.matches(Regex("#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?")) }?.uppercase(java.util.Locale.ROOT)

/** The five public hooks. Sizes use dp; colors accept RGB or RGBA hexadecimal. */
@Immutable data class AWCLoadingIndicatorAppearance(
    val color:String?=null,val size:Double?=null,val shapeSize:Double?=null,
    val containerColor:String?=null,val containerShape:AWCCornerShape?=null,
) {
    val values:Map<String,AWCValue> get()=mapOf("color" to color,"size" to size,"shapeSize" to shapeSize,
        "containerColor" to containerColor,"containerShape" to containerShape?.values).filterValues { it!=null }
    fun normalized()=fromValues(values)
    fun merged(local:AWCLoadingIndicatorAppearance)=fromValues(normalized().values+local.normalized().values)
    companion object {
        fun fromValues(values:Map<String,AWCValue>)=AWCLoadingIndicatorAppearance(
            loadingColor(values["color"]),loadingLength(values["size"]),loadingLength(values["shapeSize"]),
            loadingColor(values["containerColor"]),AWCCornerShape.fromValues(values["containerShape"]))
    }
}
internal val LocalAWCLoadingIndicatorAppearance=staticCompositionLocalOf { AWCLoadingIndicatorAppearance() }
@Composable fun AWCLoadingIndicatorAppearanceScope(appearance:AWCLoadingIndicatorAppearance,content:@Composable ()->Unit) {
    val inherited=LocalAWCLoadingIndicatorAppearance.current
    val resolved=remember(inherited,appearance) { inherited.merged(appearance) }
    CompositionLocalProvider(LocalAWCLoadingIndicatorAppearance provides resolved,content=content)
}

/** Native equivalent of styling the real shape part, separate from component hooks. */
@Immutable data class AWCLoadingIndicatorShapeAppearance(
    val width:Double?=null,val height:Double?=null,val color:String?=null,
) {
    internal fun normalized()=AWCLoadingIndicatorShapeAppearance(loadingLength(width),loadingLength(height),loadingColor(color))
}
internal val LocalAWCLoadingIndicatorShapeAppearance=staticCompositionLocalOf { AWCLoadingIndicatorShapeAppearance() }
@Composable fun AWCLoadingIndicatorShapeAppearanceScope(appearance:AWCLoadingIndicatorShapeAppearance,content:@Composable ()->Unit) {
    val inherited=LocalAWCLoadingIndicatorShapeAppearance.current
    val local=appearance.normalized()
    CompositionLocalProvider(LocalAWCLoadingIndicatorShapeAppearance provides AWCLoadingIndicatorShapeAppearance(
        local.width ?: inherited.width,local.height ?: inherited.height,local.color ?: inherited.color),content=content)
}
