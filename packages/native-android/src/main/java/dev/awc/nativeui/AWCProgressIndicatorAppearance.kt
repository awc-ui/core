package dev.awc.nativeui

import androidx.compose.runtime.*

/** Source progress hooks: dimensions are dp; colors are RGB/RGBA hexadecimal.
 * Signed gaps and trailing space retain their source overlap/overflow behavior.
 * Corner shapes apply to linear boxes; circular strokes retain round caps. */
@Immutable data class AWCProgressIndicatorAppearance(
    val activeIndicatorColor:String?=null,val activeIndicatorShape:AWCCornerShape?=null,
    val trackColor:String?=null,val trackShape:AWCCornerShape?=null,
    val stopIndicatorColor:String?=null,val stopIndicatorShape:AWCCornerShape?=null,
    val stopIndicatorSize:Double?=null,val stopIndicatorTrailingSpace:Double?=null,
    val trackActiveIndicatorSpace:Double?=null,
    val fourColor1:String?=null,val fourColor2:String?=null,val fourColor3:String?=null,val fourColor4:String?=null,
) {
    val values:Map<String,AWCValue> get()=mapOf(
        "activeIndicatorColor" to activeIndicatorColor,"activeIndicatorShape" to activeIndicatorShape?.values,
        "trackColor" to trackColor,"trackShape" to trackShape?.values,
        "stopIndicatorColor" to stopIndicatorColor,"stopIndicatorShape" to stopIndicatorShape?.values,
        "stopIndicatorSize" to stopIndicatorSize,"stopIndicatorTrailingSpace" to stopIndicatorTrailingSpace,
        "trackActiveIndicatorSpace" to trackActiveIndicatorSpace,
        "fourColor1" to fourColor1,"fourColor2" to fourColor2,"fourColor3" to fourColor3,"fourColor4" to fourColor4,
    ).filterValues { it!=null }
    fun normalized()=fromValues(values)
    fun merged(local:AWCProgressIndicatorAppearance)=fromValues(normalized().values+local.normalized().values)
    companion object {
        fun fromValues(values:Map<String,AWCValue>):AWCProgressIndicatorAppearance {
            fun color(key:String)=(values[key] as? String)?.takeIf { it.matches(Regex("#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?")) }?.uppercase(java.util.Locale.ROOT)
            fun number(key:String,nonnegative:Boolean=false)=(values[key] as? Number)?.toDouble()?.takeIf { it.isFinite() && (!nonnegative || it>=0) }
            return AWCProgressIndicatorAppearance(color("activeIndicatorColor"),AWCCornerShape.fromValues(values["activeIndicatorShape"]),
                color("trackColor"),AWCCornerShape.fromValues(values["trackShape"]),color("stopIndicatorColor"),AWCCornerShape.fromValues(values["stopIndicatorShape"]),
                number("stopIndicatorSize",true),number("stopIndicatorTrailingSpace"),number("trackActiveIndicatorSpace"),
                color("fourColor1"),color("fourColor2"),color("fourColor3"),color("fourColor4"))
        }
    }
}
internal val LocalAWCProgressIndicatorAppearance=staticCompositionLocalOf { AWCProgressIndicatorAppearance() }
@Composable fun AWCProgressIndicatorAppearanceScope(appearance:AWCProgressIndicatorAppearance,content:@Composable ()->Unit) {
    val inherited=LocalAWCProgressIndicatorAppearance.current
    val resolved=remember(inherited,appearance) { inherited.merged(appearance) }
    CompositionLocalProvider(LocalAWCProgressIndicatorAppearance provides resolved,content=content)
}
