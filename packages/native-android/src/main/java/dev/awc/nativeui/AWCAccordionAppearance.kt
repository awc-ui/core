package dev.awc.nativeui

import androidx.compose.runtime.*
import androidx.compose.ui.graphics.Color

private val AccordionHex=Regex("#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?")
private fun accordionColor(value:String?)=value?.takeIf { it.matches(AccordionHex) }?.uppercase(java.util.Locale.ROOT)
private fun accordionLength(value:Double?)=value?.takeIf { it.isFinite() && it>=0 }

/** Physical source edges in dp. Logical start/end are resolved at the use site. */
@Immutable data class AWCAccordionInsets(val top:Double,val right:Double,val bottom:Double,val left:Double) {
    constructor(block:Double,inline:Double):this(block,inline,block,inline)
    internal val valid get()=listOf(top,right,bottom,left).all { it.isFinite() && it>=0 }
    internal val values get()=mapOf("top" to top,"right" to right,"bottom" to bottom,"left" to left)
    internal fun start(rtl:Boolean)=if(rtl) right else left
    internal fun end(rtl:Boolean)=if(rtl) left else right
    companion object {
        fun fromValues(value:Any?):AWCAccordionInsets? {
            val map=value as? Map<*,*> ?: return null
            if(map.keys.any { it !in setOf("top","right","bottom","left") }) return null
            fun n(key:String)=(map[key] as? Number)?.toDouble()?.takeIf { it.isFinite() && it>=0 }
            return AWCAccordionInsets(n("top") ?: return null,n("right") ?: return null,n("bottom") ?: return null,n("left") ?: return null)
        }
    }
}

/** One source box-shadow layer. Lengths are dp; color is #RRGGBB or #RRGGBBAA. */
@Immutable data class AWCBoxShadow(val x:Double=0.0,val y:Double=0.0,val blur:Double=0.0,val spread:Double=0.0,val color:String="#00000000",val inset:Boolean=false) {
    internal val valid get()=listOf(x,y,blur,spread).all(Double::isFinite) && blur>=0 && color.matches(AccordionHex)
    internal val values get()=mapOf("x" to x,"y" to y,"blur" to blur,"spread" to spread,"color" to color,"inset" to inset)
    internal fun resolved()=NativeShadowLayer(x,y,blur,spread,statusDotColor(color.uppercase(java.util.Locale.ROOT)),inset)
    companion object {
        fun fromValues(value:Any?):AWCBoxShadow? {
            val map=value as? Map<*,*> ?: return null
            if(map.keys.any { it !in setOf("x","y","blur","spread","color","inset") }) return null
            fun n(key:String)=if(!map.containsKey(key)) 0.0 else (map[key] as? Number)?.toDouble()?.takeIf(Double::isFinite)
            val shadow=AWCBoxShadow(n("x") ?: return null,n("y") ?: return null,n("blur") ?: return null,n("spread") ?: return null,
                accordionColor(map["color"] as? String) ?: return null,(map["inset"] as? Boolean) ?: false)
            return shadow.takeIf { it.valid }
        }
        internal fun list(value:Any?):List<AWCBoxShadow>? {
            val list=value as? List<*> ?: return null
            return list.map { fromValues(it) ?: return null }
        }
    }
}

/** A resolved shadow layer in dp with a native color. */
internal data class NativeShadowLayer(val x:Double,val y:Double,val blur:Double,val spread:Double,val color:Color,val inset:Boolean) {
    companion object {
        /** Parses the generated source elevation tokens, e.g. `0px 1px 2px rgba(0, 0, 0, 0.3), ...`. */
        fun parse(css:String?):List<NativeShadowLayer> {
            val value=css?.trim().orEmpty()
            if(value.isEmpty() || value=="none") return emptyList()
            val layers=mutableListOf<String>();var depth=0;var start=0
            value.forEachIndexed { i,c -> when(c) { '('->depth++;')'->depth--;','->if(depth==0) { layers+=value.substring(start,i);start=i+1 } } }
            layers+=value.substring(start)
            return layers.mapNotNull { layer ->
                var text=layer.trim();var inset=false
                if(text.startsWith("inset ")) { inset=true;text=text.removePrefix("inset ").trim() }
                if(text.endsWith(" inset")) { inset=true;text=text.removeSuffix(" inset").trim() }
                val colorStart=listOf(text.indexOf("rgb"),text.indexOf('#')).filter { it>=0 }.minOrNull()
                val colorText=colorStart?.let { text.substring(it).trim() } ?: "rgba(0,0,0,1)"
                val lengths=(if(colorStart!=null) text.substring(0,colorStart) else text).trim().split(Regex("\\s+")).filter { it.isNotEmpty() }
                    .map { it.removeSuffix("px").toDoubleOrNull() ?: return@mapNotNull null }
                if(lengths.size<2) return@mapNotNull null
                val color=if(colorText.startsWith("#")) accordionColor(colorText)?.let(::statusDotColor) ?: return@mapNotNull null else awcColor(colorText,Color.Transparent)
                NativeShadowLayer(lengths[0],lengths[1],lengths.getOrElse(2) { 0.0 },lengths.getOrElse(3) { 0.0 },color,inset)
            }
        }
        /** CSS list interpolation: pad with transparent zero layers; a differing inset
         * mode switches the whole list discretely at the midpoint. */
        fun interpolate(from:List<NativeShadowLayer>,to:List<NativeShadowLayer>,t:Double):List<NativeShadowLayer> {
            if(t<=0) return from;if(t>=1) return to
            val count=maxOf(from.size,to.size)
            fun at(list:List<NativeShadowLayer>,i:Int,other:List<NativeShadowLayer>)=list.getOrNull(i) ?: NativeShadowLayer(0.0,0.0,0.0,0.0,Color.Transparent,other.getOrNull(i)?.inset ?: false)
            if((0 until count).any { at(from,it,to).inset!=at(to,it,from).inset }) return if(t<.5) from else to
            return (0 until count).map { i ->
                val a=at(from,i,to);val b=at(to,i,from);val f=t.toFloat()
                NativeShadowLayer(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t,a.blur+(b.blur-a.blur)*t,a.spread+(b.spread-a.spread)*t,accordionMix(a.color,b.color,f),a.inset)
            }
        }
    }
}

/** CSS color interpolation uses premultiplied sRGB. */
internal fun accordionMix(a:Color,b:Color,t:Float):Color {
    if(t<=0f) return a;if(t>=1f) return b
    val alpha=a.alpha+(b.alpha-a.alpha)*t
    if(alpha<=0f) return Color.Transparent
    fun channel(x:Float,y:Float)=((x*a.alpha)+((y*b.alpha)-(x*a.alpha))*t)/alpha
    return Color(channel(a.red,b.red).coerceIn(0f,1f),channel(a.green,b.green).coerceIn(0f,1f),channel(a.blue,b.blue).coerceIn(0f,1f),alpha.coerceIn(0f,1f))
}

/** The 14 parent hooks: gap, outline colour, container shape, elevation, the five floating-panel hooks and the five drop-placeholder hooks. */
@Immutable data class AWCAccordionAppearance(
    val gap:Double?=null,val outlineColor:String?=null,val containerShape:AWCCornerShape?=null,val elevation:List<AWCBoxShadow>?=null,
    val floatingWidth:Double?=null,val floatingBackground:String?=null,val floatingElevation:List<AWCBoxShadow>?=null,
    val floatingElevationActive:List<AWCBoxShadow>?=null,val floatingRadius:AWCCornerShape?=null,
    val dropPlaceholderColor:String?=null,val dropPlaceholderOutlineColor:String?=null,val dropPlaceholderOutlineWidth:Double?=null,
    val dropPlaceholderShape:AWCCornerShape?=null,val dropPlaceholderOpacity:Double?=null,
) {
    internal fun normalized()=AWCAccordionAppearance(accordionLength(gap),accordionColor(outlineColor),containerShape,elevation?.takeIf { l->l.all { it.valid } },
        accordionLength(floatingWidth),accordionColor(floatingBackground),floatingElevation?.takeIf { l->l.all { it.valid } },
        floatingElevationActive?.takeIf { l->l.all { it.valid } },floatingRadius,accordionColor(dropPlaceholderColor),accordionColor(dropPlaceholderOutlineColor),
        accordionLength(dropPlaceholderOutlineWidth),dropPlaceholderShape,dropPlaceholderOpacity?.takeIf(Double::isFinite)?.coerceIn(0.0,1.0))
    fun merged(local:AWCAccordionAppearance):AWCAccordionAppearance { val a=normalized();val b=local.normalized()
        return AWCAccordionAppearance(b.gap ?: a.gap,b.outlineColor ?: a.outlineColor,b.containerShape ?: a.containerShape,b.elevation ?: a.elevation,
            b.floatingWidth ?: a.floatingWidth,b.floatingBackground ?: a.floatingBackground,b.floatingElevation ?: a.floatingElevation,
            b.floatingElevationActive ?: a.floatingElevationActive,b.floatingRadius ?: a.floatingRadius,b.dropPlaceholderColor ?: a.dropPlaceholderColor,
            b.dropPlaceholderOutlineColor ?: a.dropPlaceholderOutlineColor,b.dropPlaceholderOutlineWidth ?: a.dropPlaceholderOutlineWidth,
            b.dropPlaceholderShape ?: a.dropPlaceholderShape,b.dropPlaceholderOpacity ?: a.dropPlaceholderOpacity) }
    companion object {
        fun fromValues(values:Map<String,AWCValue>):AWCAccordionAppearance {
            fun n(key:String)=(values[key] as? Number)?.toDouble()
            fun s(key:String)=values[key] as? String
            return AWCAccordionAppearance(n("gap"),s("outlineColor"),AWCCornerShape.fromValues(values["containerShape"]),AWCBoxShadow.list(values["elevation"]),
                n("floatingWidth"),s("floatingBackground"),AWCBoxShadow.list(values["floatingElevation"]),AWCBoxShadow.list(values["floatingElevationActive"]),
                AWCCornerShape.fromValues(values["floatingRadius"]),s("dropPlaceholderColor"),s("dropPlaceholderOutlineColor"),n("dropPlaceholderOutlineWidth"),
                AWCCornerShape.fromValues(values["dropPlaceholderShape"]),n("dropPlaceholderOpacity")).normalized()
        }
    }
}

/** The 24 item hooks. Durations are milliseconds; colors are #RRGGBB(AA). */
@Immutable data class AWCAccordionItemAppearance(
    val containerColor:String?=null,val containerColorExpanded:String?=null,val containerColorDragging:String?=null,
    val containerShape:AWCCornerShape?=null,val containerShapeExpanded:AWCCornerShape?=null,val containerShapeDragging:AWCCornerShape?=null,
    val headerColor:String?=null,val headerColorExpanded:String?=null,val headlineColor:String?=null,val headlineColorExpanded:String?=null,
    val supportingColor:String?=null,val iconColor:String?=null,val iconColorExpanded:String?=null,
    val stateLayerColor:String?=null,val stateLayerColorExpanded:String?=null,
    val headerPadding:AWCAccordionInsets?=null,val contentPadding:AWCAccordionInsets?=null,val headerMinHeight:Double?=null,
    val expandDuration:Double?=null,val collapseDuration:Double?=null,
    val elevation:List<AWCBoxShadow>?=null,val elevationExpanded:List<AWCBoxShadow>?=null,
    val chassisHandleColor:String?=null,val chassisHandleBackgroundHover:String?=null,
) {
    internal fun normalized()=AWCAccordionItemAppearance(accordionColor(containerColor),accordionColor(containerColorExpanded),accordionColor(containerColorDragging),
        containerShape,containerShapeExpanded,containerShapeDragging,accordionColor(headerColor),accordionColor(headerColorExpanded),
        accordionColor(headlineColor),accordionColor(headlineColorExpanded),accordionColor(supportingColor),accordionColor(iconColor),accordionColor(iconColorExpanded),
        accordionColor(stateLayerColor),accordionColor(stateLayerColorExpanded),headerPadding?.takeIf { it.valid },contentPadding?.takeIf { it.valid },
        accordionLength(headerMinHeight),accordionLength(expandDuration),accordionLength(collapseDuration),
        elevation?.takeIf { l->l.all { it.valid } },elevationExpanded?.takeIf { l->l.all { it.valid } },accordionColor(chassisHandleColor),accordionColor(chassisHandleBackgroundHover))
    fun merged(local:AWCAccordionItemAppearance):AWCAccordionItemAppearance { val a=normalized();val b=local.normalized()
        return AWCAccordionItemAppearance(b.containerColor ?: a.containerColor,b.containerColorExpanded ?: a.containerColorExpanded,b.containerColorDragging ?: a.containerColorDragging,
            b.containerShape ?: a.containerShape,b.containerShapeExpanded ?: a.containerShapeExpanded,b.containerShapeDragging ?: a.containerShapeDragging,
            b.headerColor ?: a.headerColor,b.headerColorExpanded ?: a.headerColorExpanded,b.headlineColor ?: a.headlineColor,b.headlineColorExpanded ?: a.headlineColorExpanded,
            b.supportingColor ?: a.supportingColor,b.iconColor ?: a.iconColor,b.iconColorExpanded ?: a.iconColorExpanded,b.stateLayerColor ?: a.stateLayerColor,
            b.stateLayerColorExpanded ?: a.stateLayerColorExpanded,b.headerPadding ?: a.headerPadding,b.contentPadding ?: a.contentPadding,b.headerMinHeight ?: a.headerMinHeight,
            b.expandDuration ?: a.expandDuration,b.collapseDuration ?: a.collapseDuration,b.elevation ?: a.elevation,b.elevationExpanded ?: a.elevationExpanded,
            b.chassisHandleColor ?: a.chassisHandleColor,b.chassisHandleBackgroundHover ?: a.chassisHandleBackgroundHover) }
    companion object {
        fun fromValues(values:Map<String,AWCValue>):AWCAccordionItemAppearance {
            fun n(key:String)=(values[key] as? Number)?.toDouble()
            fun s(key:String)=values[key] as? String
            fun shape(key:String)=AWCCornerShape.fromValues(values[key])
            return AWCAccordionItemAppearance(s("containerColor"),s("containerColorExpanded"),s("containerColorDragging"),shape("containerShape"),shape("containerShapeExpanded"),
                shape("containerShapeDragging"),s("headerColor"),s("headerColorExpanded"),s("headlineColor"),s("headlineColorExpanded"),s("supportingColor"),
                s("iconColor"),s("iconColorExpanded"),s("stateLayerColor"),s("stateLayerColorExpanded"),AWCAccordionInsets.fromValues(values["headerPadding"]),
                AWCAccordionInsets.fromValues(values["contentPadding"]),n("headerMinHeight"),n("expandDuration"),n("collapseDuration"),
                AWCBoxShadow.list(values["elevation"]),AWCBoxShadow.list(values["elevationExpanded"]),s("chassisHandleColor"),s("chassisHandleBackgroundHover")).normalized()
        }
    }
}

internal val LocalAWCAccordionAppearance=staticCompositionLocalOf { AWCAccordionAppearance() }
internal val LocalAWCAccordionItemAppearance=staticCompositionLocalOf { AWCAccordionItemAppearance() }

/** Group hooks inherit like source custom properties; wrap one group to target it. */
@Composable fun AWCAccordionAppearanceScope(appearance:AWCAccordionAppearance,content:@Composable ()->Unit) {
    val inherited=LocalAWCAccordionAppearance.current
    val resolved=remember(inherited,appearance) { inherited.merged(appearance) }
    CompositionLocalProvider(LocalAWCAccordionAppearance provides resolved,content=content)
}
/** Item hooks inherit through groups and nested content; wrap one item to target it. */
@Composable fun AWCAccordionItemAppearanceScope(appearance:AWCAccordionItemAppearance,content:@Composable ()->Unit) {
    val inherited=LocalAWCAccordionItemAppearance.current
    val resolved=remember(inherited,appearance) { inherited.merged(appearance) }
    CompositionLocalProvider(LocalAWCAccordionItemAppearance provides resolved,content=content)
}
