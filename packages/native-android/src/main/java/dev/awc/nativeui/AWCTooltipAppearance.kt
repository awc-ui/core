package dev.awc.nativeui

import androidx.compose.runtime.*

typealias AWCTooltipLength = AWCSkeletonLength

/** All eleven source hooks. Colors use CSS #RRGGBB or #RRGGBBAA order. */
@Immutable data class AWCTooltipAppearance(
    val plainContainerColor:String?=null,val plainTextColor:String?=null,
    val richContainerColor:String?=null,val richSubheadColor:String?=null,
    val richTextColor:String?=null,val richActionColor:String?=null,
    val plainShape:AWCCornerShape?=null,val plainMaxWidth:AWCTooltipLength?=null,
    val richShape:AWCCornerShape?=null,val richMinWidth:AWCTooltipLength?=null,val richMaxWidth:AWCTooltipLength?=null,
) {
    val values:Map<String,AWCValue> get()=mapOf("plainContainerColor" to plainContainerColor,"plainTextColor" to plainTextColor,
        "richContainerColor" to richContainerColor,"richSubheadColor" to richSubheadColor,"richTextColor" to richTextColor,
        "richActionColor" to richActionColor,"plainShape" to plainShape?.values,"plainMaxWidth" to plainMaxWidth?.values,
        "richShape" to richShape?.values,"richMinWidth" to richMinWidth?.values,"richMaxWidth" to richMaxWidth?.values).filterValues { it!=null }
    fun normalized()=fromValues(values)
    fun merged(local:AWCTooltipAppearance)=fromValues(normalized().values+local.normalized().values)
    companion object {
        fun fromValues(values:Map<String,AWCValue>):AWCTooltipAppearance {
            fun color(key:String)=(values[key] as? String)?.takeIf { it.matches(Regex("#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?")) }?.uppercase(java.util.Locale.ROOT)
            return AWCTooltipAppearance(color("plainContainerColor"),color("plainTextColor"),color("richContainerColor"),
                color("richSubheadColor"),color("richTextColor"),color("richActionColor"),AWCCornerShape.fromValues(values["plainShape"]),
                AWCTooltipLength.fromValues(values["plainMaxWidth"]),AWCCornerShape.fromValues(values["richShape"]),
                AWCTooltipLength.fromValues(values["richMinWidth"]),AWCTooltipLength.fromValues(values["richMaxWidth"]))
        }
    }
}
internal val LocalAWCTooltipAppearance=staticCompositionLocalOf { AWCTooltipAppearance() }
@Composable fun AWCTooltipAppearanceScope(appearance:AWCTooltipAppearance,content:@Composable ()->Unit) {
    val inherited=LocalAWCTooltipAppearance.current
    val resolved=remember(inherited,appearance) { inherited.merged(appearance) }
    CompositionLocalProvider(LocalAWCTooltipAppearance provides resolved,content=content)
}

enum class AWCTooltipPart { Popup, Text, Subhead, SupportingText, Actions }
/** Sparse source part styling. Margin and letter spacing may be negative;
 * border/padding are nonnegative, font metrics positive. Authored child styles
 * remain authoritative over inherited text appearance. */
@Immutable data class AWCTooltipPartAppearance(
    val color:String?=null,val backgroundColor:String?=null,val borderColor:String?=null,
    val borderWidth:Double?=null,val cornerShape:AWCCornerShape?=null,val fontWeight:Int?=null,
    val paddingInlineStart:Double?=null,val marginInlineStart:Double?=null,
    val letterSpacing:Double?=null,val fontSize:Double?=null,val lineHeight:Double?=null,
) {
    internal fun merged(local:AWCTooltipPartAppearance):AWCTooltipPartAppearance {
        fun color(v:String?)=v?.takeIf { it.matches(Regex("#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?")) }?.uppercase(java.util.Locale.ROOT)
        fun length(v:Double?)=v?.takeIf { it.isFinite() && it in 0.0..8192.0 }
        fun signed(v:Double?)=v?.takeIf { it.isFinite() && it in -8192.0..8192.0 }
        fun metric(v:Double?)=v?.takeIf { it.isFinite() && it>0 && it<=8192 }
        return AWCTooltipPartAppearance(color(local.color) ?: color(color),color(local.backgroundColor) ?: color(backgroundColor),
            color(local.borderColor) ?: color(borderColor),length(local.borderWidth) ?: length(borderWidth),local.cornerShape ?: cornerShape,
            local.fontWeight?.takeIf { it in 1..1000 } ?: fontWeight?.takeIf { it in 1..1000 },
            length(local.paddingInlineStart) ?: length(paddingInlineStart),signed(local.marginInlineStart) ?: signed(marginInlineStart),
            signed(local.letterSpacing) ?: signed(letterSpacing),metric(local.fontSize) ?: metric(fontSize),metric(local.lineHeight) ?: metric(lineHeight))
    }
}
internal val LocalAWCTooltipParts=staticCompositionLocalOf { emptyMap<AWCTooltipPart,AWCTooltipPartAppearance>() }
@Composable fun AWCTooltipPartAppearanceScope(appearance:AWCTooltipPartAppearance,part:AWCTooltipPart=AWCTooltipPart.Popup,content:@Composable ()->Unit) {
    val inherited=LocalAWCTooltipParts.current
    CompositionLocalProvider(LocalAWCTooltipParts provides (inherited+
        (part to (inherited[part] ?: AWCTooltipPartAppearance()).merged(appearance))),content=content)
}
