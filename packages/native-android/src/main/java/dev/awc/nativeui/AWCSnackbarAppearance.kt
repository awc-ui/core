package dev.awc.nativeui

import androidx.compose.runtime.*

/** Source CSS lengths retained as affine native and parent/font-relative terms. */
typealias AWCSnackbarLength = AWCSkeletonLength

/** The seven source hooks. Colors accept #RRGGBB and #RRGGBBAA. */
@Immutable data class AWCSnackbarAppearance(
    val containerColor:String?=null,val messageColor:String?=null,
    val actionColor:String?=null,val closeColor:String?=null,
    val containerShape:AWCCornerShape?=null,
    val minWidth:AWCSnackbarLength?=null,val maxWidth:AWCSnackbarLength?=null,
) {
    val values:Map<String,AWCValue> get()=mapOf("containerColor" to containerColor,
        "messageColor" to messageColor,"actionColor" to actionColor,"closeColor" to closeColor,
        "containerShape" to containerShape?.values,"minWidth" to minWidth?.values,
        "maxWidth" to maxWidth?.values).filterValues { it!=null }
    fun normalized()=fromValues(values)
    fun merged(local:AWCSnackbarAppearance)=fromValues(normalized().values+local.normalized().values)
    companion object {
        fun fromValues(values:Map<String,AWCValue>):AWCSnackbarAppearance {
            fun color(key:String)=(values[key] as? String)?.takeIf {
                it.matches(Regex("#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?"))
            }?.uppercase(java.util.Locale.ROOT)
            return AWCSnackbarAppearance(color("containerColor"),color("messageColor"),
                color("actionColor"),color("closeColor"),AWCCornerShape.fromValues(values["containerShape"]),
                AWCSnackbarLength.fromValues(values["minWidth"]),AWCSnackbarLength.fromValues(values["maxWidth"]))
        }
    }
}
internal val LocalAWCSnackbarAppearance=staticCompositionLocalOf { AWCSnackbarAppearance() }
@Composable fun AWCSnackbarAppearanceScope(appearance:AWCSnackbarAppearance,content:@Composable ()->Unit) {
    val inherited=LocalAWCSnackbarAppearance.current
    val resolved=remember(inherited,appearance) { inherited.merged(appearance) }
    CompositionLocalProvider(LocalAWCSnackbarAppearance provides resolved,content=content)
}

internal val LocalAWCForwardedIconAppearance=staticCompositionLocalOf<AWCSnackbarPartAppearance?> { null }

enum class AWCSnackbarPart { Surface, Message, Actions, Close, CloseIcon }
/** Sparse native equivalents of source part styling. Lengths are logical units;
 * colors use CSS RGBA order. Authored slot styling remains authoritative.
 * Surface weight inherits into authored action/close text; Message has its own
 * source weight. Fallback Button remains medium and the vector CloseIcon has no
 * font weight. Action/close colors remain owned by their source hook/slot styles;
 * wrapper color does not override those explicit child colors. */
@Immutable data class AWCSnackbarPartAppearance(
    val color:String?=null,val backgroundColor:String?=null,val borderColor:String?=null,
    val borderWidth:Double?=null,val cornerShape:AWCCornerShape?=null,
    val fontWeight:Int?=null,val paddingInlineStart:Double?=null,val marginInlineStart:Double?=null,
) {
    internal fun merged(local:AWCSnackbarPartAppearance):AWCSnackbarPartAppearance {
        fun color(value:String?)=value?.takeIf { it.matches(Regex("#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?")) }?.uppercase(java.util.Locale.ROOT)
        fun length(value:Double?)=value?.takeIf { it.isFinite() && it>=0 && it<=8192 }
        fun margin(value:Double?)=value?.takeIf { it.isFinite() && it in -8192.0..8192.0 }
        return AWCSnackbarPartAppearance(color(local.color) ?: color(color),color(local.backgroundColor) ?: color(backgroundColor),
            color(local.borderColor) ?: color(borderColor),length(local.borderWidth) ?: length(borderWidth),local.cornerShape ?: cornerShape,
            local.fontWeight?.takeIf { it in 1..1000 } ?: fontWeight?.takeIf { it in 1..1000 },
            length(local.paddingInlineStart) ?: length(paddingInlineStart),margin(local.marginInlineStart) ?: margin(marginInlineStart))
    }
}
internal val LocalAWCSnackbarParts=staticCompositionLocalOf { emptyMap<AWCSnackbarPart,AWCSnackbarPartAppearance>() }
@Composable fun AWCSnackbarPartAppearanceScope(
    appearance:AWCSnackbarPartAppearance,part:AWCSnackbarPart=AWCSnackbarPart.Surface,content:@Composable ()->Unit,
) {
    val inherited=LocalAWCSnackbarParts.current
    CompositionLocalProvider(LocalAWCSnackbarParts provides (inherited+
        (part to (inherited[part] ?: AWCSnackbarPartAppearance()).merged(appearance))),content=content)
}
