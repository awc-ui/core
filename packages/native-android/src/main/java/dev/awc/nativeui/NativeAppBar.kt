package dev.awc.nativeui

import android.animation.ValueAnimator
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.LocalTextStyle
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.RoundRect
import androidx.compose.ui.graphics.*
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.key.*
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.PointerEventType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.*
import androidx.compose.ui.node.ModifierNodeElement
import androidx.compose.ui.node.ParentDataModifierNode
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.PlatformTextStyle
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.text.style.LineHeightStyle
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

// md-app-bar: dedicated Compose renderer (small, medium, large and search bars).
// Contract: docs/native-parity/md-app-bar-source-review.md; geometry, colours and motion from md-app-bar.css / md-app-bar.tsx
// (the SwiftUI renderer NativeAppBar.swift implements the same model).

/** The 38 md-app-bar CSS custom properties (hooks) as CSS text ("72px", "#FFF3E0", "0 0 24px 24px", a box-shadow list). */
@Immutable data class AWCAppBarAppearance(
    val containerColor:String?=null, val containerColorScrolled:String?=null, val containerShape:String?=null, val headlineColor:String?=null,
    val subtitleColor:String?=null, val leadingIconColor:String?=null, val trailingIconColor:String?=null, val containerElevation:String?=null,
    val rowHeight:String?=null, val paddingInlineStart:String?=null, val paddingInlineEnd:String?=null, val rowPaddingInline:String?=null,
    val rowPaddingBlockStart:String?=null, val trailingGap:String?=null, val trailingIconTouchSize:String?=null, val iconGap:String?=null,
    val iconSize:String?=null, val avatarSize:String?=null, val expandedPaddingInline:String?=null, val expandedPaddingBlockEnd:String?=null,
    val mediumHeight:String?=null, val mediumHeightWithSubtitle:String?=null, val largeHeight:String?=null, val largeHeightWithSubtitle:String?=null,
    val iconButtonSize:String?=null, val searchContainerColor:String?=null, val searchContainerColorScrolled:String?=null, val searchContainerShape:String?=null,
    val searchContainerHeight:String?=null, val searchPaddingInlineStart:String?=null, val searchPaddingInlineEnd:String?=null, val searchRowGap:String?=null,
    val searchTrailingGap:String?=null, val searchFieldTrailingGap:String?=null, val trailingTouchSize:String?=null, val searchPlaceholderColor:String?=null,
    val searchInputColor:String?=null, val searchTrailingIconColor:String?=null,
) {
    operator fun get(hook:String):String?=when(hook) {
        "container-color"->containerColor
        "container-color-scrolled"->containerColorScrolled
        "container-shape"->containerShape
        "headline-color"->headlineColor
        "subtitle-color"->subtitleColor
        "leading-icon-color"->leadingIconColor
        "trailing-icon-color"->trailingIconColor
        "container-elevation"->containerElevation
        "row-height"->rowHeight
        "padding-inline-start"->paddingInlineStart
        "padding-inline-end"->paddingInlineEnd
        "row-padding-inline"->rowPaddingInline
        "row-padding-block-start"->rowPaddingBlockStart
        "trailing-gap"->trailingGap
        "trailing-icon-touch-size"->trailingIconTouchSize
        "icon-gap"->iconGap
        "icon-size"->iconSize
        "avatar-size"->avatarSize
        "expanded-padding-inline"->expandedPaddingInline
        "expanded-padding-block-end"->expandedPaddingBlockEnd
        "medium-height"->mediumHeight
        "medium-height-with-subtitle"->mediumHeightWithSubtitle
        "large-height"->largeHeight
        "large-height-with-subtitle"->largeHeightWithSubtitle
        "icon-button-size"->iconButtonSize
        "search-container-color"->searchContainerColor
        "search-container-color-scrolled"->searchContainerColorScrolled
        "search-container-shape"->searchContainerShape
        "search-container-height"->searchContainerHeight
        "search-padding-inline-start"->searchPaddingInlineStart
        "search-padding-inline-end"->searchPaddingInlineEnd
        "search-row-gap"->searchRowGap
        "search-trailing-gap"->searchTrailingGap
        "search-field-trailing-gap"->searchFieldTrailingGap
        "trailing-touch-size"->trailingTouchSize
        "search-placeholder-color"->searchPlaceholderColor
        "search-input-color"->searchInputColor
        "search-trailing-icon-color"->searchTrailingIconColor
        else->null }
    internal fun with(hook:String,v:String?):AWCAppBarAppearance=when(hook) {
        "container-color"->copy(containerColor=v)
        "container-color-scrolled"->copy(containerColorScrolled=v)
        "container-shape"->copy(containerShape=v)
        "headline-color"->copy(headlineColor=v)
        "subtitle-color"->copy(subtitleColor=v)
        "leading-icon-color"->copy(leadingIconColor=v)
        "trailing-icon-color"->copy(trailingIconColor=v)
        "container-elevation"->copy(containerElevation=v)
        "row-height"->copy(rowHeight=v)
        "padding-inline-start"->copy(paddingInlineStart=v)
        "padding-inline-end"->copy(paddingInlineEnd=v)
        "row-padding-inline"->copy(rowPaddingInline=v)
        "row-padding-block-start"->copy(rowPaddingBlockStart=v)
        "trailing-gap"->copy(trailingGap=v)
        "trailing-icon-touch-size"->copy(trailingIconTouchSize=v)
        "icon-gap"->copy(iconGap=v)
        "icon-size"->copy(iconSize=v)
        "avatar-size"->copy(avatarSize=v)
        "expanded-padding-inline"->copy(expandedPaddingInline=v)
        "expanded-padding-block-end"->copy(expandedPaddingBlockEnd=v)
        "medium-height"->copy(mediumHeight=v)
        "medium-height-with-subtitle"->copy(mediumHeightWithSubtitle=v)
        "large-height"->copy(largeHeight=v)
        "large-height-with-subtitle"->copy(largeHeightWithSubtitle=v)
        "icon-button-size"->copy(iconButtonSize=v)
        "search-container-color"->copy(searchContainerColor=v)
        "search-container-color-scrolled"->copy(searchContainerColorScrolled=v)
        "search-container-shape"->copy(searchContainerShape=v)
        "search-container-height"->copy(searchContainerHeight=v)
        "search-padding-inline-start"->copy(searchPaddingInlineStart=v)
        "search-padding-inline-end"->copy(searchPaddingInlineEnd=v)
        "search-row-gap"->copy(searchRowGap=v)
        "search-trailing-gap"->copy(searchTrailingGap=v)
        "search-field-trailing-gap"->copy(searchFieldTrailingGap=v)
        "trailing-touch-size"->copy(trailingTouchSize=v)
        "search-placeholder-color"->copy(searchPlaceholderColor=v)
        "search-input-color"->copy(searchInputColor=v)
        "search-trailing-icon-color"->copy(searchTrailingIconColor=v)
        else->this }
    /** Inherited CSS custom properties: the inner (more specific) value wins. */
    fun merging(inner:AWCAppBarAppearance):AWCAppBarAppearance { var out=this;for(h in hooks) inner[h]?.let { out=out.with(h,it) };return out }
    companion object {
        /** Hook names without the `--md-app-bar-` prefix, in source order. */
        val hooks=listOf("container-color", "container-color-scrolled", "container-shape", "headline-color", "subtitle-color", "leading-icon-color", "trailing-icon-color", "container-elevation", "row-height", "padding-inline-start", "padding-inline-end", "row-padding-inline", "row-padding-block-start", "trailing-gap", "trailing-icon-touch-size", "icon-gap", "icon-size", "avatar-size", "expanded-padding-inline", "expanded-padding-block-end", "medium-height", "medium-height-with-subtitle", "large-height", "large-height-with-subtitle", "icon-button-size", "search-container-color", "search-container-color-scrolled", "search-container-shape", "search-container-height", "search-padding-inline-start", "search-padding-inline-end", "search-row-gap", "search-trailing-gap", "search-field-trailing-gap", "trailing-touch-size", "search-placeholder-color", "search-input-color", "search-trailing-icon-color")
        /** From authored CSS custom properties (`--md-app-bar-*` names); unknown names are ignored. */
        fun fromCss(css:Map<String,String>):AWCAppBarAppearance { var a=AWCAppBarAppearance();for(h in hooks) css["--md-app-bar-$h"]?.let { a=a.with(h,it.trim()) };return a }
        /** Laboratory values: field names (`rowHeight`) or hook names (`row-height`); a number is a px length, a string CSS text.
         *  Null when a key or a value is invalid. */
        fun fromValues(values:Map<String,AWCValue>):AWCAppBarAppearance? {
            var a=AWCAppBarAppearance()
            for((k,v) in values) {
                val hook=if(k.contains('-')) k else k.replace(Regex("([A-Z])"),"-$1").lowercase(java.util.Locale.ROOT)
                if(hook !in hooks) return null
                val text=when(v) {
                    is Number->{ val d=v.toDouble();if(!d.isFinite() || d<0) return null;(if(d==Math.rint(d) && kotlin.math.abs(d)<1e15) d.toLong().toString() else d.toString())+"px" }
                    is String->{ val t=v.trim();if(t.isEmpty() || t.toByteArray().size>4096) return null;t }
                    else->return null
                }
                a=a.with(hook,text)
            }
            return a
        }
    }
}

internal val LocalAWCAppBarAppearance=staticCompositionLocalOf { AWCAppBarAppearance() }
/** md-app-bar hooks for every app bar in [content] (inner scopes override outer ones per hook). */
@Composable fun AWCAppBarAppearanceScope(appearance:AWCAppBarAppearance,content:@Composable ()->Unit)=
    CompositionLocalProvider(LocalAWCAppBarAppearance provides LocalAWCAppBarAppearance.current.merging(appearance),content=content)
internal val LocalAWCAppBarReducedMotion=staticCompositionLocalOf<Boolean?> { null }
/** `prefers-reduced-motion` for the app bars in [content] (null: the system animator setting). */
@Composable fun AWCAppBarReducedMotionScope(reduced:Boolean?,content:@Composable ()->Unit)=
    CompositionLocalProvider(LocalAWCAppBarReducedMotion provides reduced,content=content)

/** md-app-bar's CSS parts (CEM order; icon and state-layer are the fallback leading icon button's exported parts). Part rules
 *  come from the outer tree, so a native part appearance wins over the hooks and every internal state rule (an opacity
 *  replaces the part's own). Boxes (row, leading, trailing, expanded, search-host, search-field, search-trailing,
 *  leading-icon): `backgroundColor`, `cornerShape`, `opacity`; text (title, subtitle, expanded-headline): `color`, `fontSize`,
 *  `lineHeight`, `fontWeight`, `letterSpacing`, `opacity`, `backgroundColor`; search (the pill): `backgroundColor` (every
 *  state, scrolled included), `cornerShape`, `opacity`; search-state-layer: `backgroundColor`, `opacity` (fixed in every
 *  state); search-input: `color`, `fontSize`, `opacity`; search-content: `color`, `opacity`; icon: `color`; state-layer:
 *  `backgroundColor`, `opacity` (fixed in every state). */
enum class AWCAppBarPart(val source:String) {
    LeadingIcon("leading-icon"),Title("title"),Subtitle("subtitle"),ExpandedHeadline("expanded-headline"),SearchHost("search-host"),Search("search"),
    SearchStateLayer("search-state-layer"),SearchField("search-field"),SearchContent("search-content"),SearchInput("search-input"),SearchTrailing("search-trailing"),
    Row("row"),Leading("leading"),Trailing("trailing"),Expanded("expanded"),Icon("icon"),StateLayer("state-layer");
    companion object { fun fromSource(name:String)=entries.firstOrNull { it.source==name } }
}
/** The shared sparse part vocabulary (md-accordion / md-list). */
typealias AWCAppBarPartAppearance=AWCAccordionPartAppearance
internal val LocalAWCAppBarParts=staticCompositionLocalOf { emptyMap<AWCAppBarPart,AWCAccordionPartAppearance>() }
/** `md-app-bar::part(<part>)` styling for the app bars in [content] (inner scopes merge over outer ones per field). */
@Composable fun AWCAppBarPartAppearanceScope(part:AWCAppBarPart,appearance:AWCAccordionPartAppearance,content:@Composable ()->Unit) {
    val inherited=LocalAWCAppBarParts.current
    CompositionLocalProvider(LocalAWCAppBarParts provides inherited+(part to (inherited[part] ?: AWCAccordionPartAppearance()).merged(appearance)),content=content)
}
internal fun appBarPartColor(v:String?)=v?.let { awcRippleHex(it) }
/** A part's own box: its background in its corner shape (physical corners) behind its content, its opacity over both. */
internal fun Modifier.appBarPartBox(v:AWCAccordionPartAppearance?):Modifier {
    if(v==null) return this
    val bg=appBarPartColor(v.backgroundColor);val op=v.opacity
    return this.then(if(op!=null) Modifier.graphicsLayer { alpha=op.toFloat() } else Modifier)
        .then(if(bg!=null) Modifier.drawBehind { drawOutline((v.cornerShape ?: AWCCornerShape()).createOutline(size,LayoutDirection.Ltr,this),bg) } else Modifier)
}
/** A text part's typography and ink (part values win). */
internal fun TextStyle.appBarPart(v:AWCAccordionPartAppearance?):TextStyle=if(v==null) this else copy(fontSize=v.fontSize?.sp ?: fontSize,
    lineHeight=v.lineHeight?.sp ?: lineHeight,fontWeight=v.fontWeight?.let { FontWeight(it.toInt()) } ?: fontWeight,letterSpacing=v.letterSpacing?.sp ?: letterSpacing,
    color=appBarPartColor(v.color) ?: color)

/** Development diagnostics of md-app-bar: the source's console warnings, in order (also logged). */
object AWCAppBarDiagnostics {
    private val list=mutableListOf<String>()
    val warnings:List<String> get()=list.toList()
    fun clear() { list.clear() }
    internal fun warn(message:String) { list+=message;android.util.Log.w("md-app-bar",message) }
}

/** Live values of the app bars in an [AWCAppBarInspectionScope] by source id (tests and the Laboratory). */
class AWCAppBarInspection {
    val bars=mutableMapOf<String,Map<String,Any?>>()
}
internal val LocalAWCAppBarInspection=staticCompositionLocalOf<AWCAppBarInspection?> { null }
@Composable fun AWCAppBarInspectionScope(inspection:AWCAppBarInspection,content:@Composable ()->Unit)=
    CompositionLocalProvider(LocalAWCAppBarInspection provides inspection,content=content)

/** md-app-bar properties (source defaults). */
internal data class NativeAppBarModel(val variant:String,val centered:Boolean,val placeholder:String,val value:String,val ariaLabel:String,val searchDisabled:Boolean,
                                      val headline:String,val subtitle:String,val scrolled:Boolean,val leadingIcon:String,val leadingIconLabel:String,val hidden:Boolean) {
    val flexible get()=variant=="medium" || variant=="large"
    val search get()=variant=="search"
    /** The search field's accessible name: aria label, then the placeholder, then "Search". */
    val searchLabel get()=listOf(ariaLabel,placeholder).firstOrNull { it.isNotEmpty() } ?: "Search"
    companion object {
        fun from(p:Props):NativeAppBarModel { val v=p.str("variant","small")
            return NativeAppBarModel(if(v in setOf("small","medium","large","search")) v else "small",p.str("titleAlignment")=="center",p.str("searchPlaceholder","Search"),
                p.str("searchValue"),p.str("searchAriaLabel"),p.bool("searchDisabled"),p.str("headline"),p.str("subtitle"),p.bool("scrolled"),p.str("leadingIcon"),
                p.str("leadingIconLabel"),p.bool("hidden")) }
    }
}

/** CSS text of the hooks. */
internal object NativeAppBarCSS {
    fun px(s:String?):Double? { val t=s?.trim()?.lowercase(java.util.Locale.ROOT)?.takeIf { it.isNotEmpty() } ?: return null
        return (if(t.endsWith("px")) t.dropLast(2) else t).toDoubleOrNull()?.takeIf { it.isFinite() } }
    /** border-radius shorthand of one to four px radii: top-left, top-right, bottom-right, bottom-left. */
    fun corners(s:String?):List<Double>? {
        val parts=s?.trim()?.split(Regex("\\s+"))?.map { px(it) } ?: return null
        if(parts.size !in 1..4 || parts.any { it==null || it<0 }) return null
        val p=parts.map { it!! }
        return when(p.size) { 1->listOf(p[0],p[0],p[0],p[0]);2->listOf(p[0],p[1],p[0],p[1]);3->listOf(p[0],p[1],p[2],p[1]);else->p }
    }
    fun color(s:String?):String? { val t=s?.trim() ?: return null;return if(Regex("^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$").matches(t)) t.uppercase(java.util.Locale.ROOT) else null }
}

/** Resolved geometry (dp) for one density scale [s], spacing rung [r] (the -2…-4 spacing tokens) and the hooks. */
internal class NativeAppBarMetrics(val s:Double,val r:Double,val a:AWCAppBarAppearance,val model:NativeAppBarModel) {
    // The density-tapered spacing tokens (tokens.css [density] rules).
    val insetXs=4.0
    val insetSm=if(r<=-3) 4.0 else 8.0
    val insetMd=if(r<=-2) 8.0 else 12.0
    val insetLg=if(r<=-4) 8.0 else if(r<=-2) 12.0 else 16.0
    val insetXl=if(r<=-3) 16.0 else if(r<=-2) 20.0 else 24.0
    val gapXs=if(r<=-4) 2.0 else 4.0
    val gapSm=if(r<=-3) 4.0 else 8.0
    fun hook(n:String)=NativeAppBarCSS.px(a[n])
    val rowHeight=hook("row-height") ?: max(48.0,64+4*s)
    val iconButton=hook("icon-button-size") ?: max(32.0,48+4*s)
    val trailingIconTouch=hook("trailing-icon-touch-size") ?: iconButton
    val trailingGap=hook("trailing-gap") ?: 2.0
    val rowPadTop=hook("row-padding-block-start") ?: if(model.variant=="large") 20.0 else 0.0
    val iconSize=hook("icon-size") ?: max(18.0,24+s)
    val avatar=hook("avatar-size") ?: max(24.0,32+2*s)
    val expandedPadInline=hook("expanded-padding-inline") ?: insetLg
    val expandedPadBottom=hook("expanded-padding-block-end") ?: if(model.variant=="large") 28.0 else insetXl
    val padStart=hook("padding-inline-start") ?: hook("row-padding-inline") ?: insetXs
    val padEnd=hook("padding-inline-end") ?: hook("row-padding-inline") ?: insetXs
    val iconGap=hook("icon-gap") ?: 0.0
    fun flexHeight(subtitle:Boolean)=if(model.variant=="medium")
        (if(subtitle) hook("medium-height-with-subtitle") ?: (136+4*s) else hook("medium-height") ?: (112+4*s))
        else (if(subtitle) hook("large-height-with-subtitle") ?: (152+4*s) else hook("large-height") ?: (120+4*s))
    val searchHeight=hook("search-container-height") ?: max(40.0,56+4*s)
    /** The hint inset: 24 (inset-xl), at most 16 under 600 and 12 under 400 (start-aligned bars), never below 12. */
    fun searchPadStart(width:Double):Double {
        var v=hook("search-padding-inline-start") ?: insetXl
        if(!model.centered) { if(width<600) v=min(16.0,v);if(width<400) v=min(12.0,v) }
        return max(12.0,v)
    }
    val searchPadEnd=hook("search-padding-inline-end") ?: insetSm
    val searchRowGap=hook("search-row-gap") ?: gapSm
    val searchTrailingGap=hook("search-trailing-gap") ?: gapXs
    val searchFieldTrailingGap=hook("search-field-trailing-gap") ?: 6.0
    val trailingTouch=hook("trailing-touch-size") ?: max(32.0,48+4*s)
    // Typography (density tapers of title-large, headline-medium, label-large, title-medium and body-large).
    val titleSize=max(16.0,22+s); val titleLine=max(22.0,28+s)
    val headlineSize=max(22.0,28+s); val headlineLine=max(28.0,36+2*s)
    val subtitleSize=if(model.variant=="large") max(13.0,16+.5*s) else max(12.0,14+.5*s)
    val subtitleLine=if(model.variant=="large") max(18.0,24+s) else max(16.0,20+s)
    val subtitleTracking=if(model.variant=="large") .15 else .1
    val inlineSubtitleSize=max(12.0,14+.5*s); val inlineSubtitleLine=max(16.0,20+s)
    val inputSize=max(13.0,16+.5*s); val inputLine=max(18.0,24+s)
}

/** Colours of the bar (theme roles unless hooked). */
internal class NativeAppBarPalette(val tokens:Map<String,String>,val a:AWCAppBarAppearance) {
    fun role(k:String,f:String)=tokens["--md-sys-color-$k"]?.uppercase(java.util.Locale.ROOT) ?: f
    fun hook(n:String,k:String,f:String)=NativeAppBarCSS.color(a[n]) ?: role(k,f)
    val container get()=hook("container-color","surface","#FFFBFE")
    val containerScrolled get()=hook("container-color-scrolled","surface-container","#F3EDF7")
    val headline get()=hook("headline-color","on-surface","#1C1B1F")
    val subtitle get()=hook("subtitle-color","on-surface-variant","#49454F")
    val leadingIcon get()=hook("leading-icon-color","on-surface","#1C1B1F")
    val trailingIcon get()=hook("trailing-icon-color","on-surface-variant","#49454F")
    val search get()=hook("search-container-color","surface-container-highest","#E6E0E9")
    val searchScrolled get()=hook("search-container-color-scrolled","surface-container","#F3EDF7")
    val placeholder get()=hook("search-placeholder-color","on-surface-variant","#49454F")
    val input get()=hook("search-input-color","on-surface","#1C1B1F")
    val searchTrailingIcon get()=hook("search-trailing-icon-color","on-surface-variant","#49454F")
    val focusRing get()=role("secondary","#625B71")
    val shadows get()=a.containerElevation?.let { NativeShadowLayer.parse(it) } ?: emptyList()
    val containerCorners get()=NativeAppBarCSS.corners(a.containerShape) ?: listOf(0.0,0.0,0.0,0.0)
    /** null: corner-full (half the pill height). */
    val searchCorners get()=NativeAppBarCSS.corners(a.searchContainerShape)
}
internal fun appBarColor(hex:String):Color=runCatching { statusDotColor(hex) }.getOrDefault(Color.Black)
internal fun appBarHex(c:Color):String { val v=c.toArgb();return String.format(java.util.Locale.ROOT,"#%02X%02X%02X%02X",(v shr 16) and 255,(v shr 8) and 255,v and 255,(v ushr 24) and 255) }
internal fun appBarCorners(c:List<Double>)=AWCCornerShape(AWCCornerRadius(AWCCornerLength(c[0]),AWCCornerLength(c[0])),AWCCornerRadius(AWCCornerLength(c[1]),AWCCornerLength(c[1])),
    AWCCornerRadius(AWCCornerLength(c[2]),AWCCornerLength(c[2])),AWCCornerRadius(AWCCornerLength(c[3]),AWCCornerLength(c[3])))
internal val AppBarRoboto=FontFamily(Font(R.font.awc_roboto_regular,FontWeight.Normal),Font(R.font.awc_roboto_medium,FontWeight.Medium))
/** CSS line box text: fixed line height with centred half-leading, no font padding. */
internal fun appBarText(size:Double,line:Double,weight:Int,tracking:Double,color:Color,align:TextAlign=TextAlign.Start)=TextStyle(fontFamily=AppBarRoboto,fontSize=size.sp,
    lineHeight=line.sp,fontWeight=FontWeight(weight),letterSpacing=tracking.sp,color=color,textAlign=align,platformStyle=PlatformTextStyle(includeFontPadding=false),
    lineHeightStyle=LineHeightStyle(LineHeightStyle.Alignment.Center,LineHeightStyle.Trim.None))

/** Where a slotted element sits for its app bar (the `hidden` attribute, `data-compact-keep`, `data-directional`). */
internal data class NativeAppBarChild(val tag:String,val id:String,val hidden:Boolean,val compactKeep:Boolean,val directional:Boolean)
private class NativeAppBarChildNode(var child:NativeAppBarChild):Modifier.Node(),ParentDataModifierNode {
    override fun Density.modifyParentData(parentData:Any?):Any?=parentData ?: child
}
private data class NativeAppBarChildElement(val child:NativeAppBarChild):ModifierNodeElement<NativeAppBarChildNode>() {
    override fun create()=NativeAppBarChildNode(child)
    override fun update(node:NativeAppBarChildNode) { node.child=child }
}
/** Applied by AWCComponent to every element: app bar slots read it from their measurables. Inner parent data wins. */
internal fun Modifier.awcAppBarChild(tag:String,p:Props):Modifier=this.then(NativeAppBarChildElement(NativeAppBarChild(tag,p.str("id"),p.bool("hidden"),
    p.containsKey("data-compact-keep") && p["data-compact-keep"]!=false,p.containsKey("data-directional") && p["data-directional"]!=false)))
private val Measurable.appBarChild get()=parentData as? NativeAppBarChild

/** Per-bar runtime: the editing text, focus and modality, pointer state and the CSS transition tracks on the frame clock. */
@Stable internal class NativeAppBarRuntime(scrolled:Double) {
    val scrolled=AWCCSSValueTrack(scrolled,accordionLerp)
    /** The pill's own background transition (0.01 ms under reduced motion, unlike the host's). */
    val pillScrolled=AWCCSSValueTrack(scrolled,accordionLerp)
    val layer=AWCCSSValueTrack(0.0,accordionLerp)
    var frame by mutableDoubleStateOf(0.0)
    var field by mutableStateOf(TextFieldValue(""))
    var focused by mutableStateOf(false)
    var keyboardModality by mutableStateOf(false)
    var pointerFocusing=false
    var hovered by mutableStateOf(false)
    var pressed by mutableStateOf(false)
    var inputAt=Double.NaN
    var primed=false
    var layerPrimed=false
    var warned=0
    val focus=androidx.compose.ui.focus.FocusRequester()
}

private val AppBarStandard=listOf(.2,0.0,0.0,1.0)

@Composable internal fun NativeAppBar(p:Props,onEvent:EventSink,content:Slot?) {
    val m=NativeAppBarModel.from(p)
    if(m.hidden) return
    val appearance=LocalAWCAppBarAppearance.current
    val tokens=LocalAWCThemeTokens.current
    // Spacing tokens come from the nearest [density] rung that redefines them (−2…−4; −1 keeps the inherited ones).
    val g=NativeAppBarMetrics(LocalAWCNativeDensity.current,LocalAWCDensityRungs.current.firstOrNull { it<=-2.0 } ?: 0.0,appearance,m)
    val c=NativeAppBarPalette(tokens,appearance)
    val inspection=LocalAWCInspection.current
    val probe=LocalAWCAppBarInspection.current
    val reduced=LocalAWCAppBarReducedMotion.current ?: !ValueAnimator.areAnimatorsEnabled()
    val fm=1000.0/(LocalView.current.display?.refreshRate?.takeIf { it>0f }?.toDouble() ?: 60.0)
    val rtl=LocalLayoutDirection.current==LayoutDirection.Rtl
    val rt=remember { NativeAppBarRuntime(if(m.scrolled) 1.0 else 0.0) }
    val slots=ModalSlots(LocalAWCSlots.current,content)
    val id=p.str("id")
    // The input mirrors searchValue: a host value replaces the edited text (a controlled host echoing mdSearchInput keeps the caret).
    var field by remember { mutableStateOf(TextFieldValue(m.value,TextRange(m.value.length))) }
    val hostValue=remember { arrayOf<String?>(null) }
    if(hostValue[0]!=m.value) { hostValue[0]=m.value;if(field.text!=m.value) field=TextFieldValue(m.value,TextRange(m.value.length)) }
    // `scrolled`: background-color transitions (short2 100 ms, standard); reduced motion shortens only the pill's (0.01 ms).
    LaunchedEffect(m.scrolled,reduced) {
        val f=withFrameNanos { it }/1e6
        val target=if(m.scrolled) 1.0 else 0.0
        if(!rt.primed) { rt.primed=true;rt.scrolled.snap(target);rt.pillScrolled.snap(target);rt.frame=f;return@LaunchedEffect }
        rt.scrolled.set(target,f,100.0,AppBarStandard)
        rt.pillScrolled.set(target,f,if(reduced) .01 else 100.0,AppBarStandard)
        rt.frame=f
        while(rt.scrolled.isRunning(rt.frame) || rt.pillScrolled.isRunning(rt.frame)) rt.frame=withFrameNanos { it }/1e6
        rt.frame=withFrameNanos { it }/1e6
    }
    // Search state layer (:hover 8 %, :active 12 %): opacity transition short1 50 ms from two frames after the input.
    val layerTarget=if(rt.pressed) .12 else if(rt.hovered) .08 else 0.0
    LaunchedEffect(layerTarget) {
        val f=withFrameNanos { it }/1e6
        if(!rt.layerPrimed) { rt.layerPrimed=true;rt.layer.snap(layerTarget);return@LaunchedEffect }
        val ref=rt.inputAt
        rt.layer.set(layerTarget,if(!ref.isNaN() && f-ref>=0 && f-ref<=4*fm) ref+2*fm else f,50.0,AppBarStandard)
        rt.frame=f
        while(rt.layer.isRunning(rt.frame)) rt.frame=withFrameNanos { it }/1e6
        rt.frame=withFrameNanos { it }/1e6
    }
    // The trailing slot shows at most three actions (an author-hidden one does not count): one warning per new excess count.
    var shownTrailing by remember { mutableIntStateOf(0) }
    LaunchedEffect(shownTrailing) {
        val over=if(shownTrailing>3) shownTrailing else 0
        if(over>0 && over!=rt.warned) AWCAppBarDiagnostics.warn("[md-app-bar] The trailing slot supports at most 3 action icons; $shownTrailing were provided. Icons beyond the limit are hidden.")
        rt.warned=over
    }
    val emit:(String,AWCValue)->Unit={ n,v-> onEvent(n,v) }
    val shape=appBarCorners(c.containerCorners)
    val shadows=c.shadows
    val container=appBarColor(c.container);val containerScrolled=appBarColor(c.containerScrolled)
    AppBarColumn(m,g,Modifier.fillMaxWidth()
        .then(if(shadows.isNotEmpty()) Modifier.accordionShadow(shape,shadows,false) else Modifier)
        .drawBehind {
            val fill=accordionColorLerp(container,containerScrolled,rt.scrolled.presented(rt.frame))
            drawOutline(shape.createOutline(size,layoutDirection,this),fill)
            probe?.let { it.bars[id]=(it.bars[id] ?: emptyMap())+mapOf("fill" to appBarHex(fill),"scrolled" to m.scrolled,"warned" to rt.warned,"frame" to rt.frame) }
        }) {
        val report:(List<String>)->Unit={ ids-> probe?.let { it.bars[id]=(it.bars[id] ?: emptyMap())+mapOf("trailingShown" to ids) } }
        if(m.search) AppBarSearchRow(m,g,c,rt,slots,inspection,probe,id,field,{ field=it },emit,rtl,onEvent,{ shownTrailing=it },report)
        else AppBarRow(m,g,c,slots,inspection,rtl,onEvent,{ shownTrailing=it },report)
        if(m.flexible) AppBarExpanded(m,g,c,slots,inspection)
    }
}

/** The bar: its row, then (flexible bars) the expanded block below it. */
@Composable private fun AppBarColumn(m:NativeAppBarModel,g:NativeAppBarMetrics,modifier:Modifier,content:@Composable ()->Unit) {
    Layout(content,modifier) { ms,cons->
        val w=if(cons.hasBoundedWidth) cons.maxWidth else ms.maxOfOrNull { it.maxIntrinsicWidth(Constraints.Infinity) } ?: 0
        val ps=ms.map { it.measure(Constraints(minWidth=w,maxWidth=w)) }
        val h=ps.sumOf { it.height }
        layout(w,h) { var y=0;for(pl in ps) { pl.place(0,y);y+=pl.height } }
    }
}

// MARK: - text and slots

/** Prop text, else the named slot's content in the same style (one line with an ellipsis, or wrapping). */
@Composable private fun AppBarText(text:String,slot:String?,slots:ModalSlots,style:TextStyle,lines:Int,fill:Boolean,part:String,inspection:AWCInspectionContext?,
                                    pv:AWCAccordionPartAppearance?=null) {
    Box(Modifier.then(if(fill) Modifier.fillMaxWidth() else Modifier).appBarPartBox(pv).inspectAWCNode(inspection,part,part)) {
        if(text.isNotEmpty() && !fill) AppBarExactText(text,style,lines)
        else if(text.isNotEmpty()) BasicText(text,style=style,maxLines=lines,overflow=if(lines==1) TextOverflow.Ellipsis else TextOverflow.Clip,softWrap=lines!=1)
        else if(slot!=null) CompositionLocalProvider(LocalTextStyle provides style,androidx.compose.material3.LocalContentColor provides style.color,
            LocalAWCSlotTextNoWrap provides (lines==1),LocalAWCSlotTextOverflow provides (if(lines==1) TextOverflow.Ellipsis else TextOverflow.Clip)) { slots.Render(slot) }
    }
}

/** Max-content text whose box is Chrome's width (exact fractional Roboto advances, not the line width rounded up to a pixel). */
@Composable private fun AppBarExactText(text:String,style:TextStyle,lines:Int) {
    val ctx=androidx.compose.ui.platform.LocalContext.current
    val exact=remember(text,style) { NativeAppBarTextWidth.of(ctx,text,style.fontSize.value.toDouble(),style.fontWeight?.weight ?: 400,style.letterSpacing.value.toDouble()) }
    Layout({ BasicText(text,style=style,maxLines=lines,softWrap=lines!=1,overflow=TextOverflow.Visible) }) { ms,cons->
        val ex=(exact*density).roundToInt()
        if(ex<=cons.maxWidth) {
            val pl=ms[0].measure(Constraints())
            layout(ex,pl.height) { pl.placeRelative(when(style.textAlign) { TextAlign.Center->(ex-pl.width)/2;else->0 },0) }
        } else { val pl=ms[0].measure(cons.copy(minWidth=0));layout(pl.width,pl.height) { pl.placeRelative(0,0) } }
    }
}
internal object NativeAppBarTextWidth {
    private val faces=mutableMapOf<Int,android.graphics.Typeface>()
    fun of(context:android.content.Context,text:String,size:Double,weight:Int,spacing:Double):Double {
        if(text.isEmpty()) return 0.0
        val face=faces.getOrPut(weight) { context.resources.getFont(if(weight>=500) R.font.awc_roboto_medium else R.font.awc_roboto_regular) }
        val paint=android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG or android.graphics.Paint.SUBPIXEL_TEXT_FLAG or android.graphics.Paint.LINEAR_TEXT_FLAG)
        paint.typeface=face;paint.textSize=(size*64).toFloat()
        if(spacing!=0.0) paint.letterSpacing=(spacing/size).toFloat()
        // Chrome adds letter-spacing after every character, the last one included; the Android measure leaves the last one out.
        return paint.measureText(text)/64.0+spacing
    }
}

/** The inline headline (title over subtitle): fills the row on start-aligned bars, max-content on centred ones; invisible
 *  (opacity 0, hidden from accessibility) on flexible bars, whose expanded block shows the headline. */
@Composable private fun AppBarInline(m:NativeAppBarModel,g:NativeAppBarMetrics,c:NativeAppBarPalette,slots:ModalSlots,inspection:AWCInspectionContext?,modifier:Modifier) {
    val start=!m.centered;val parts=LocalAWCAppBarParts.current
    val tp=parts[AWCAppBarPart.Title];val sp=parts[AWCAppBarPart.Subtitle]
    Layout(content={
        AppBarText(m.headline,if(m.flexible) null else "headline",slots,appBarText(g.titleSize,g.titleLine,400,0.0,appBarColor(c.headline)).appBarPart(tp),1,start,"title",inspection,tp)
        AppBarText(m.subtitle,if(m.flexible) null else "subtitle",slots,appBarText(g.inlineSubtitleSize,g.inlineSubtitleLine,500,.1,appBarColor(c.subtitle)).appBarPart(sp),1,start,
            if(m.flexible) "inline-subtitle" else "subtitle",inspection,sp)
    },modifier.graphicsLayer { alpha=if(m.flexible) 0f else 1f }.then(if(m.flexible) Modifier.clearAndSetSemantics { } else Modifier)
        .inspectAWCNode(inspection,"headline-inline","headline-inline")) { ms,cons->
        val pad=((if(m.centered) g.insetSm else g.insetMd)*density).roundToInt();val gap=(2*density).roundToInt()
        val inner=if(cons.hasBoundedWidth) max(0,cons.maxWidth-2*pad) else Constraints.Infinity
        val child=if(start && cons.hasBoundedWidth) Constraints(minWidth=inner,maxWidth=inner) else Constraints(maxWidth=inner)
        val t=ms[0].measure(child);val s=ms[1].measure(child)
        if(t.height==0 && s.height==0) return@Layout layout(cons.minWidth,0) { }
        val w=if(start && cons.hasBoundedWidth) cons.maxWidth else max(t.width,s.width)+2*pad
        val h=t.height+(if(s.height>0) gap+s.height else 0)
        layout(w,h) {
            t.placeRelative(if(start) pad else (w-t.width)/2,0)
            if(s.height>0) s.placeRelative(if(start) pad else (w-s.width)/2,t.height+gap)
        }
    }
}

/** Leading slot content, else the leading icon button (`leading-icon`); slotted `data-directional` items mirror in RTL. */
@Composable private fun AppBarLeading(m:NativeAppBarModel,g:NativeAppBarMetrics,c:NativeAppBarPalette,slots:ModalSlots,inspection:AWCInspectionContext?,rtl:Boolean,onEvent:EventSink) {
    val parts=LocalAWCAppBarParts.current
    AWCIconButtonAppearanceScope(AWCIconButtonAppearance(iconColor=c.leadingIcon,stateLayerColor=c.leadingIcon,iconSize=g.iconSize,width=g.iconButton,height=g.iconButton)) {
        SubcomposeLayout { cons->
            val loose=cons.copy(minWidth=0,minHeight=0)
            val authored=subcompose("slot") { slots.Render("leading") }
            val measured=authored.map { it.measure(loose) to it.appBarChild }
            val present=slots.registered("leading") || authored.any { it.appBarChild!=null } || measured.any { it.first.width>0 || it.first.height>0 }
            val items=if(present) measured else if(m.leadingIcon.isNotEmpty()) subcompose("fallback") {
                // The exported icon / state-layer parts: the glyph's ink; a fixed state layer (the button's own one is replaced).
                val sl=parts[AWCAppBarPart.StateLayer]
                Box(Modifier.appBarPartBox(parts[AWCAppBarPart.LeadingIcon]).inspectAWCNode(inspection,"leading-icon","leading-icon")) {
                    AWCIconButtonAppearanceScope(AWCIconButtonAppearance(iconColor=parts[AWCAppBarPart.Icon]?.color ?: c.leadingIcon,stateLayerColor=if(sl==null) c.leadingIcon else "#00000000",
                        iconSize=g.iconSize,width=g.iconButton,height=g.iconButton)) {
                        AWCComponent("md-icon-button",mapOf("icon" to m.leadingIcon,"variant" to "standard","size" to "md","buttonWidth" to "narrow")+
                            (if(m.leadingIconLabel.isEmpty()) emptyMap() else mapOf("aria-label" to m.leadingIconLabel)),onEvent={ n,_-> if(n=="mdClick") onEvent("mdLeadingClick",null) })
                    }
                    appBarPartColor(sl?.backgroundColor)?.let { bg-> val a=(sl?.opacity ?: 0.0).toFloat()
                        Box(Modifier.matchParentSize().drawBehind { drawRoundRect(bg.copy(alpha=bg.alpha*a),cornerRadius=CornerRadius(size.height/2,size.height/2)) }) }
                }
            }.map { it.measure(loose) to null } else emptyList()
            val w=items.sumOf { it.first.width };val h=items.maxOfOrNull { it.first.height } ?: 0
            layout(w,h) { var x=0
                for((pl,child) in items) { if(rtl && child?.directional==true) pl.placeRelativeWithLayer(x,(h-pl.height)/2) { scaleX=-1f } else pl.placeRelative(x,(h-pl.height)/2);x+=pl.width } }
        }
    }
}

/** Trailing actions: at most three shown (author-hidden ones do not count), `trailing-gap` apart. */
@Composable private fun AppBarTrailing(g:NativeAppBarMetrics,c:NativeAppBarPalette,slots:ModalSlots,shown:(Int)->Unit,report:(List<String>)->Unit) {
    AWCIconButtonAppearanceScope(AWCIconButtonAppearance(iconColor=c.trailingIcon,stateLayerColor=c.trailingIcon,iconSize=g.iconSize,width=g.trailingIconTouch,height=g.trailingIconTouch)) {
        AWCAvatarAppearanceScope(AWCAvatarAppearance(size=AWCSkeletonLength(points=g.avatar))) {
            Layout({ slots.Render("trailing") }) { ms,cons->
                val visible=ms.filter { it.appBarChild?.hidden!=true }
                shown(visible.size)
                val kept=visible.take(3).toSet()
                // Actions beyond the cap take no space and draw nothing (alpha 0 also keeps them out of accessibility).
                report(kept.mapNotNull { it.appBarChild?.id?.takeIf { id-> id.isNotEmpty() } })
                val ps=ms.map { if(it in kept) it.measure(cons.copy(minWidth=0,minHeight=0)) else it.measure(Constraints.fixed(0,0)) }
                val gap=(g.trailingGap*density).roundToInt()
                val placed=ps.filterIndexed { i,_-> ms[i] in kept }
                val w=placed.sumOf { it.width }+max(0,placed.size-1)*gap;val h=placed.maxOfOrNull { it.height } ?: 0
                layout(w,h) { var x=0
                    ps.forEachIndexed { i,pl-> if(ms[i] in kept) { pl.placeRelative(x,(h-pl.height)/2);x+=pl.width+gap } else pl.placeWithLayer(0,0) { alpha=0f } } }
            }
        }
    }
}

// MARK: - rows

@Composable private fun AppBarRow(m:NativeAppBarModel,g:NativeAppBarMetrics,c:NativeAppBarPalette,slots:ModalSlots,inspection:AWCInspectionContext?,rtl:Boolean,onEvent:EventSink,
                                  shown:(Int)->Unit,report:(List<String>)->Unit) {
    // Start-aligned large rows align their items to the top (flex-start); every other row (and the centred grid) centres them.
    val top=m.variant=="large" && !m.centered;val parts=LocalAWCAppBarParts.current
    Layout(content={
        Box(Modifier.appBarPartBox(parts[AWCAppBarPart.Leading]).inspectAWCNode(inspection,"leading","leading")) { AppBarLeading(m,g,c,slots,inspection,rtl,onEvent) }
        AppBarInline(m,g,c,slots,inspection,Modifier)
        Box(Modifier.appBarPartBox(parts[AWCAppBarPart.Trailing]).inspectAWCNode(inspection,"trailing","trailing")) { AppBarTrailing(g,c,slots,shown,report) }
    },Modifier.appBarPartBox(parts[AWCAppBarPart.Row]).inspectAWCNode(inspection,"row","row")) { ms,cons->
        val d=density
        val w=cons.maxWidth;val padS=(g.padStart*d).roundToInt();val padE=(g.padEnd*d).roundToInt()
        val padTop=(g.rowPadTop*d).roundToInt();val rowH=(g.rowHeight*d).roundToInt();val gap=(g.iconGap*d).roundToInt()
        val inner=max(0,w-padS-padE)
        val lead=ms[0].measure(Constraints(maxWidth=inner,maxHeight=rowH));val trail=ms[2].measure(Constraints(maxWidth=inner,maxHeight=rowH))
        fun y(h:Int)=padTop+if(top) 0 else (rowH-h)/2
        if(!m.centered) {
            val inlineW=max(0,inner-lead.width-trail.width-2*gap)
            val inl=ms[1].measure(Constraints(minWidth=inlineW,maxWidth=inlineW,maxHeight=rowH))
            layout(w,padTop+rowH) { lead.placeRelative(padS,y(lead.height));inl.placeRelative(padS+lead.width+gap,y(inl.height));trail.placeRelative(w-padE-trail.width,y(trail.height)) }
        } else {
            // Grid: minmax(icon button, 1fr) | minmax(0, auto) | minmax(icon button, 1fr); the headline keeps its max-content width
            // (justify-self: center) and overflows its track evenly.
            val inl=ms[1].measure(Constraints(maxHeight=rowH))
            val icon=(g.iconButton*d).roundToInt();val free=max(0,inner-2*gap)
            val center=min(inl.width,max(0,free-2*icon));val side=max(icon,(free-center)/2)
            layout(w,padTop+rowH) {
                lead.placeRelative(padS,y(lead.height))
                inl.placeRelative(padS+side+gap+(center-inl.width)/2,y(inl.height))
                trail.placeRelative(padS+side+gap+center+gap+side-trail.width,y(trail.height))
            }
        }
    }
}

@Composable private fun AppBarExpanded(m:NativeAppBarModel,g:NativeAppBarMetrics,c:NativeAppBarPalette,slots:ModalSlots,inspection:AWCInspectionContext?) {
    val align=if(m.centered) TextAlign.Center else TextAlign.Start;val parts=LocalAWCAppBarParts.current
    val hp=parts[AWCAppBarPart.ExpandedHeadline];val sp=parts[AWCAppBarPart.Subtitle]
    Layout(content={
        AppBarText(m.headline,"headline",slots,appBarText(g.headlineSize,g.headlineLine,400,0.0,appBarColor(c.headline),align).appBarPart(hp),Int.MAX_VALUE,!m.centered,"expanded-headline",inspection,hp)
        AppBarText(m.subtitle,"subtitle",slots,appBarText(g.subtitleSize,g.subtitleLine,500,g.subtitleTracking,appBarColor(c.subtitle),align).appBarPart(sp),Int.MAX_VALUE,!m.centered,"subtitle",inspection,sp)
    },Modifier.appBarPartBox(parts[AWCAppBarPart.Expanded]).clipToBounds().inspectAWCNode(inspection,"expanded","expanded")) { ms,cons->
        val d=density;val w=cons.maxWidth
        val padX=(g.expandedPadInline*d).roundToInt();val padB=(g.expandedPadBottom*d).roundToInt();val gap=(2*d).roundToInt()
        val inner=max(0,w-2*padX)
        val child=if(m.centered) Constraints(maxWidth=inner) else Constraints(minWidth=inner,maxWidth=inner)
        val head=ms[0].measure(child);val sub=ms[1].measure(child)
        val hasSub=sub.height>0
        // height: auto over the variant's min-height (the row takes its part): a wrapped headline grows the bar.
        val minH=max(0,((g.flexHeight(hasSub)-g.rowHeight-g.rowPadTop)*d).roundToInt())
        val h=max(minH,head.height+(if(hasSub) gap+sub.height else 0)+padB)
        layout(w,h) {
            val subY=h-padB-sub.height;val headY=(if(hasSub) subY-gap else h-padB)-head.height
            head.placeRelative(if(m.centered) (w-head.width)/2 else padX,headY)
            if(hasSub) sub.placeRelative(if(m.centered) (w-sub.width)/2 else padX,subY)
        }
    }
}

// MARK: - search

@Composable private fun AppBarSearchRow(m:NativeAppBarModel,g:NativeAppBarMetrics,c:NativeAppBarPalette,rt:NativeAppBarRuntime,slots:ModalSlots,inspection:AWCInspectionContext?,
                                        probe:AWCAppBarInspection?,id:String,field:TextFieldValue,setField:(TextFieldValue)->Unit,emit:(String,AWCValue)->Unit,rtl:Boolean,
                                        onEvent:EventSink,shown:(Int)->Unit,report:(List<String>)->Unit) {
    var width by remember { mutableIntStateOf(0) }
    val parts=LocalAWCAppBarParts.current
    Layout(content={
        Box(Modifier.appBarPartBox(parts[AWCAppBarPart.Leading]).inspectAWCNode(inspection,"leading","leading"),contentAlignment=Alignment.CenterStart) { AppBarLeading(m,g,c,slots,inspection,rtl,onEvent) }
        Box(Modifier.appBarPartBox(parts[AWCAppBarPart.SearchHost]).inspectAWCNode(inspection,"search-host","search-host"),contentAlignment=Alignment.Center) {
            AppBarPill(m,g,c,rt,slots,inspection,probe,id,field,setField,emit,with(LocalDensity.current) { width.toDp().value.toDouble() })
        }
        Box(Modifier.appBarPartBox(parts[AWCAppBarPart.Trailing]).inspectAWCNode(inspection,"trailing","trailing"),contentAlignment=Alignment.Center) { AppBarTrailing(g,c,slots,shown,report) }
    },Modifier.appBarPartBox(parts[AWCAppBarPart.Row]).inspectAWCNode(inspection,"row","row")) { ms,cons->
        val d=density;val w=cons.maxWidth;if(width!=w) width=w
        val padS=(g.padStart*d).roundToInt();val padE=(g.padEnd*d).roundToInt();val padTop=(g.rowPadTop*d).roundToInt()
        val rowH=(g.rowHeight*d).roundToInt();val gap=(g.searchRowGap*d).roundToInt()
        val icon=(g.iconButton*d).roundToInt();val touch=(g.trailingTouch*d).roundToInt()
        val lead=ms[0].measure(Constraints(minWidth=icon,maxWidth=max(icon,w),maxHeight=rowH))
        val trail=ms[2].measure(Constraints(minWidth=touch,minHeight=min(touch,rowH),maxWidth=max(touch,w),maxHeight=rowH))
        val pillW=max(0,w-padS-padE-lead.width-trail.width-2*gap)
        val host=ms[1].measure(Constraints.fixed(pillW,rowH))
        layout(w,padTop+rowH) {
            lead.placeRelative(padS,padTop+(rowH-lead.height)/2)
            host.placeRelative(padS+lead.width+gap,padTop)
            trail.placeRelative(w-padE-trail.width,padTop+(rowH-trail.height)/2)
        }
    }
}

@Composable private fun AppBarPill(m:NativeAppBarModel,g:NativeAppBarMetrics,c:NativeAppBarPalette,rt:NativeAppBarRuntime,slots:ModalSlots,inspection:AWCInspectionContext?,
                                   probe:AWCAppBarInspection?,id:String,field:TextFieldValue,setField:(TextFieldValue)->Unit,emit:(String,AWCValue)->Unit,barWidth:Double) {
    val disabled=m.searchDisabled
    // The search part wins over the hooks and the scrolled rule (colour, corners, opacity); search-state-layer fixes the layer.
    val parts=LocalAWCAppBarParts.current;val sp=parts[AWCAppBarPart.Search];val lp=parts[AWCAppBarPart.SearchStateLayer]
    val corners=sp?.cornerShape?.let { s-> listOf(s.topLeft.x.points,s.topRight.x.points,s.bottomRight.x.points,s.bottomLeft.x.points) } ?: c.searchCorners
    val radii=corners ?: List(4) { g.searchHeight/2 }
    val shape=appBarCorners(radii)
    val partFill=appBarPartColor(sp?.backgroundColor);val layerInk=appBarPartColor(lp?.backgroundColor)
    val search=appBarColor(c.search);val searchScrolled=appBarColor(c.searchScrolled);val ink=appBarColor(c.input);val ringColor=appBarColor(c.focusRing)
    val ring=rt.focused && rt.keyboardModality && !disabled
    val padStart=g.searchPadStart(barWidth)
    Layout(content={
        AppBarField(m,g,c,rt,slots,inspection,field,setField,emit,padStart)
        AppBarSearchTrailing(g,c,slots,barWidth,inspection)
    },Modifier.graphicsLayer { alpha=sp?.opacity?.toFloat() ?: if(disabled) .38f else 1f }.fillMaxWidth().height(g.searchHeight.dp)
        .drawBehind {
            val fill=partFill ?: accordionColorLerp(search,searchScrolled,rt.pillScrolled.presented(rt.frame))
            val outline=shape.createOutline(size,layoutDirection,this)
            drawOutline(outline,fill)
            // The state layer is display: none on a disabled search; hover / press still drive its (hidden) opacity.
            val layer=lp?.opacity ?: if(disabled) 0.0 else rt.layer.presented(rt.frame)
            val li=layerInk ?: ink
            if(layer>0) drawOutline(outline,li.copy(alpha=li.alpha*layer.toFloat()))
            probe?.let { it.bars[id]=(it.bars[id] ?: emptyMap())+mapOf("pillFill" to appBarHex(fill),"layer" to layer,"layerOpacity" to rt.layer.presented(rt.frame),
                "focused" to rt.focused,"focusRing" to ring,"opacity" to (if(disabled) .38 else 1.0),"hovered" to rt.hovered,"pressed" to rt.pressed,
                "value" to field.text,"selection" to field.selection.start,"placeholderCentered" to m.centered) }
        }
        // md-ripple (grow short2 100 ms, standard; no inline extent) in the pill's current colour; none while disabled.
        .awcRipple(disabled=disabled,cornerRadius=min(radii.min(),g.searchHeight/2).dp,contentColor=ink,
            appearance=AWCRippleAppearance(extendInline=0.0,growDuration=100.0,growEasing="cubic-bezier(0.2, 0, 0, 1)"))
        .drawWithContent {
            drawContent()
            // CSS outline 3 px at offset 2 px: the stroke's centre line 3.5 outside the pill, its radii grown by as much.
            if(ring) { val o=3.5f*density;val r=radii.map { (it.toFloat()*density)+o }
                val path=Path().apply { addRoundRect(RoundRect(-o,-o,size.width+o,size.height+o,CornerRadius(r[0]),CornerRadius(r[1]),CornerRadius(r[2]),CornerRadius(r[3]))) }
                drawPath(path,ringColor,style=Stroke(3f*density)) }
        }
        .pointerInput(Unit) {
            awaitPointerEventScope {
                while(true) {
                    val e=awaitPointerEvent(PointerEventPass.Initial)
                    val c=e.changes.firstOrNull() ?: continue
                    val time=c.uptimeMillis.toDouble()
                    // :hover follows the mouse position (every event, Exit included); :active the press.
                    if(c.type==androidx.compose.ui.input.pointer.PointerType.Mouse || e.type==PointerEventType.Exit) {
                        val inside=e.type!=PointerEventType.Exit && c.position.x>=0 && c.position.y>=0 && c.position.x<size.width && c.position.y<size.height
                        if(rt.hovered!=inside) { rt.inputAt=time;rt.hovered=inside }
                    }
                    when(e.type) {
                        PointerEventType.Press->{ rt.inputAt=time;rt.pressed=true }
                        PointerEventType.Release->{ rt.inputAt=time;rt.pressed=false }
                        else->{}
                    }
                }
            }
        }
        .inspectAWCNode(inspection,"search","search")) { ms,cons->
        val d=density;val w=cons.maxWidth;val h=cons.maxHeight
        val tr=ms[1].measure(Constraints(maxWidth=w))
        val hasTrailing=tr.width>0 || tr.height>0
        val padEnd=if(hasTrailing) (g.searchPadEnd*d).roundToInt() else 0
        val fieldGap=if(hasTrailing) (g.searchFieldTrailingGap*d).roundToInt()+(g.iconGap*d).roundToInt() else 0
        val fieldW=max(0,w-padEnd-tr.width-fieldGap)
        val fl=ms[0].measure(Constraints(minWidth=fieldW,maxWidth=fieldW,maxHeight=h))
        layout(w,h) { fl.placeRelative(0,(h-fl.height)/2);tr.placeRelative(w-padEnd-tr.width,(h-tr.height)/2) }
    }
}

/** In-pill actions (`search-trailing`): compact bars (< 600) keep only the first unless `data-compact-keep`. */
@Composable private fun AppBarSearchTrailing(g:NativeAppBarMetrics,c:NativeAppBarPalette,slots:ModalSlots,barWidth:Double,inspection:AWCInspectionContext?) {
    AWCIconButtonAppearanceScope(AWCIconButtonAppearance(iconColor=c.searchTrailingIcon,stateLayerColor=c.searchTrailingIcon,iconSize=g.iconSize,width=g.iconButton,height=g.iconButton)) {
        Layout({ slots.Render("search-trailing") },Modifier.appBarPartBox(LocalAWCAppBarParts.current[AWCAppBarPart.SearchTrailing]).inspectAWCNode(inspection,"search-trailing","search-trailing")) { ms,cons->
            val kept=ms.filterIndexed { i,it-> barWidth>=600 || i==0 || it.appBarChild?.compactKeep==true }
            val ps=kept.map { it.measure(cons.copy(minWidth=0,minHeight=0)) }
            val gap=(g.searchTrailingGap*density).roundToInt()
            val w=ps.sumOf { it.width }+max(0,ps.size-1)*gap;val h=ps.maxOfOrNull { it.height } ?: 0
            layout(w,h) { var x=0;for(pl in ps) { pl.placeRelative(x,(h-pl.height)/2);x+=pl.width+gap } }
        }
    }
}

/** The search field: slotted `search` content, else the input (hint inset at the start; centred bars centre only the hint). */
@Composable private fun AppBarField(m:NativeAppBarModel,g:NativeAppBarMetrics,c:NativeAppBarPalette,rt:NativeAppBarRuntime,slots:ModalSlots,inspection:AWCInspectionContext?,
                                    field:TextFieldValue,setField:(TextFieldValue)->Unit,emit:(String,AWCValue)->Unit,padStart:Double) {
    val parts=LocalAWCAppBarParts.current;val ip=parts[AWCAppBarPart.SearchInput];val cp=parts[AWCAppBarPart.SearchContent]
    val baseStyle=appBarText(g.inputSize,g.inputLine,400,.5,appBarColor(c.input))
    // search-input: its ink, caret and font size (the placeholder inherits the size); search-content: the slotted text's ink.
    val inputStyle=baseStyle.copy(fontSize=ip?.fontSize?.sp ?: baseStyle.fontSize,color=appBarPartColor(ip?.color) ?: baseStyle.color)
    SubcomposeLayout(Modifier.appBarPartBox(parts[AWCAppBarPart.SearchField]).inspectAWCNode(inspection,"search-field","search-field")
        .pointerInput(m.searchDisabled) {
            // A press on the field focuses the input at once (mousedown default action); that focus is a pointer focus (no ring).
            awaitEachGesture {
                awaitFirstDown(requireUnconsumed=false,pass=PointerEventPass.Initial)
                if(!m.searchDisabled && !rt.focused && !slots.registered("search")) { rt.pointerFocusing=true;runCatching { rt.focus.requestFocus() } }
            }
        }) { cons->
        val d=density;val w=cons.maxWidth;val h=cons.maxHeight
        val slotted=subcompose("slot") {
            val contentStyle=baseStyle.copy(lineHeight=(g.inputSize*1.171875).sp,color=appBarPartColor(cp?.color) ?: baseStyle.color)
            CompositionLocalProvider(LocalTextStyle provides contentStyle,androidx.compose.material3.LocalContentColor provides contentStyle.color,LocalAWCSlotTextNoWrap provides true,
                LocalAWCSlotTextOverflow provides TextOverflow.Ellipsis) {
                Box(Modifier.then(cp?.opacity?.let { a-> Modifier.graphicsLayer { alpha=a.toFloat() } } ?: Modifier).inspectAWCNode(inspection,"search-content","search-content")) { slots.Render("search") }
            }
        }.map { it.measure(Constraints(maxWidth=max(0,w-if(m.centered) 0 else (padStart*d).roundToInt()),maxHeight=h)) }
        if(slots.registered("search") || slotted.any { it.width>0 && it.height>0 }) {
            // The field's own hint inset applies to slotted content (start-aligned bars; the input carries it otherwise).
            val inset=if(m.centered) 0 else (padStart*d).roundToInt();val lh=slotted.maxOfOrNull { it.height } ?: 0
            layout(w,lh) { slotted.forEach { it.placeRelative(inset,0) } }
        } else {
            val input=subcompose("input") { AppBarInput(m,g,c,rt,inspection,field,setField,emit,padStart,inputStyle) }
                .map { it.measure(Constraints(minWidth=w,maxWidth=w,maxHeight=h)) }
            val ih=input.maxOfOrNull { it.height } ?: 0
            layout(w,ih) { input.forEach { it.placeRelative(0,0) } }
        }
    }
}

@Composable private fun AppBarInput(m:NativeAppBarModel,g:NativeAppBarMetrics,c:NativeAppBarPalette,rt:NativeAppBarRuntime,inspection:AWCInspectionContext?,
                                    field:TextFieldValue,setField:(TextFieldValue)->Unit,emit:(String,AWCValue)->Unit,padStart:Double,inputStyle:TextStyle) {
    val disabled=m.searchDisabled
    val centeredHint=m.centered && field.text.isEmpty()
    fun activate(value:String) { emit("mdSearchActivate",mapOf("value" to value)) }
    // Chrome's text selection highlight (an opaque #A9CAF6 behind the selected text).
    CompositionLocalProvider(androidx.compose.foundation.text.selection.LocalTextSelectionColors provides
        androidx.compose.foundation.text.selection.TextSelectionColors(handleColor=appBarColor(c.input),backgroundColor=Color(0xFFA9CAF6))) {
    BasicTextField(value=field,
        onValueChange={ next->
            val previous=field.text
            if(next.text!=previous) {
                rt.keyboardModality=true
                // Space announces activation before the character lands (the source's keydown), then the input event.
                if(next.composition==null && next.text.length==previous.length+1 && next.text.count { it==' ' }==previous.count { it==' ' }+1) activate(previous)
                setField(next);emit("mdSearchInput",mapOf("value" to next.text))
            } else setField(next)
        },
        enabled=!disabled,singleLine=true,textStyle=inputStyle,cursorBrush=SolidColor(inputStyle.color),
        keyboardOptions=KeyboardOptions(capitalization=KeyboardCapitalization.None,keyboardType=KeyboardType.Text,imeAction=ImeAction.Search),
        keyboardActions=KeyboardActions(onSearch={ rt.keyboardModality=true;activate(field.text) }),
        decorationBox={ inner->
            Box(Modifier.fillMaxWidth().padding(start=padStart.dp,end=if(m.centered) padStart.dp else 0.dp),contentAlignment=Alignment.CenterStart) {
                if(field.text.isEmpty()) BasicText(m.placeholder,Modifier.fillMaxWidth(),style=inputStyle.copy(color=appBarColor(c.placeholder),textAlign=if(centeredHint) TextAlign.Center else TextAlign.Start),
                    maxLines=1,overflow=TextOverflow.Ellipsis)
                inner()
            }
        },
        modifier=Modifier.fillMaxWidth().height(g.inputLine.dp)
            .then(LocalAWCAppBarParts.current[AWCAppBarPart.SearchInput]?.opacity?.let { a-> Modifier.graphicsLayer { alpha=a.toFloat() } } ?: Modifier)
            .focusRequester(rt.focus)
            .onFocusChanged { s->
                if(s.isFocused==rt.focused) return@onFocusChanged
                // :focus-visible: a focus the pointer gave shows no ring until the user types; any other focus (Tab, focus()) does.
                val keyboard=s.isFocused && !rt.pointerFocusing
                rt.keyboardModality=keyboard;rt.pointerFocusing=false
                if(keyboard && field.text.isNotEmpty()) setField(field.copy(selection=TextRange(0,field.text.length)))
                rt.focused=s.isFocused
                if(s.isFocused && !disabled) activate(field.text)
            }
            .onPreviewKeyEvent { e->
                if(e.type!=KeyEventType.KeyDown) false
                else when(e.key) {
                    Key.Enter,Key.NumPadEnter->{ rt.keyboardModality=true;activate(field.text);true }
                    Key.MoveHome->{ setField(field.copy(selection=TextRange(0)));true }
                    Key.MoveEnd->{ setField(field.copy(selection=TextRange(field.text.length)));true }
                    else->false
                }
            }
            .semantics { contentDescription=m.searchLabel }
            .inspectAWCNode(inspection,"search-input","search-input"))
    }
}
