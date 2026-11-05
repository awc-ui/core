package dev.awc.nativeui

import androidx.compose.runtime.*

/** The seven source hooks; dimensions use dp, colors use RGB/RGBA hexadecimal. */
@Immutable data class AWCMeterAppearance(
    val indicatorColor:String?=null,val trackColor:String?=null,val trackShape:AWCCornerShape?=null,
    val height:Double?=null,val labelColor:String?=null,val valueColor:String?=null,val size:Double?=null,
) {
    val values:Map<String,AWCValue> get()=mapOf("indicatorColor" to indicatorColor,"trackColor" to trackColor,
        "trackShape" to trackShape?.values,"height" to height,"labelColor" to labelColor,"valueColor" to valueColor,"size" to size).filterValues { it!=null }
    fun normalized()=fromValues(values)
    fun merged(local:AWCMeterAppearance)=fromValues(normalized().values+local.normalized().values)
    companion object {
        fun fromValues(values:Map<String,AWCValue>):AWCMeterAppearance {
            fun color(key:String)=(values[key] as? String)?.takeIf { it.matches(Regex("#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?")) }?.uppercase(java.util.Locale.ROOT)
            fun size(key:String)=(values[key] as? Number)?.toDouble()?.takeIf { it.isFinite() && it>=0 }
            return AWCMeterAppearance(color("indicatorColor"),color("trackColor"),AWCCornerShape.fromValues(values["trackShape"]),size("height"),color("labelColor"),color("valueColor"),size("size"))
        }
    }
}
internal val LocalAWCMeterAppearance=staticCompositionLocalOf { AWCMeterAppearance() }
@Composable fun AWCMeterAppearanceScope(appearance:AWCMeterAppearance,content:@Composable ()->Unit) {
    val inherited=LocalAWCMeterAppearance.current
    val resolved=remember(inherited,appearance) { inherited.merged(appearance) }
    CompositionLocalProvider(LocalAWCMeterAppearance provides resolved,content=content)
}
