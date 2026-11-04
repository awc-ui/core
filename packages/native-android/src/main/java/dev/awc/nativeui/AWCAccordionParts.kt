package dev.awc.nativeui

import androidx.compose.runtime.*

/** The thirteen exported md-accordion-item parts. Chassis parts belong to floating mode. */
enum class AWCAccordionItemPart(val source:String) {
    Heading("heading"),Header("header"),StateLayer("state-layer"),DragHandle("drag-handle"),
    ChassisHandle("chassis-handle"),ChassisHandleBar("chassis-handle-bar"),LeadingIcon("leading-icon"),
    TrailingIcon("trailing-icon"),Headline("headline"),SupportingText("supporting-text"),
    Panel("panel"),Content("content"),ContentInner("content-inner");
    companion object { fun fromSource(name:String)=entries.firstOrNull { it.source==name } }
}

/**
 * Sparse native declarations for one exported surface (the `::part()` styling capability).
 * Physical edges follow the source CSS box in every direction. Lengths are dp, colours are
 * #RRGGBB or #RRGGBBAA, margins may be negative; typography inherits only where the source
 * part inherits it (header typography reaches the headline, not the supporting text).
 */
@Immutable data class AWCAccordionPartAppearance(
    val color:String?=null,val backgroundColor:String?=null,val borderColor:String?=null,val borderWidth:Double?=null,
    val cornerShape:AWCCornerShape?=null,val padding:AWCAccordionInsets?=null,val margin:AWCAccordionInsets?=null,
    val width:Double?=null,val height:Double?=null,val minHeight:Double?=null,val opacity:Double?=null,val gap:Double?=null,
    val fontSize:Double?=null,val lineHeight:Double?=null,val fontWeight:Double?=null,val letterSpacing:Double?=null,
) {
    internal fun normalized():AWCAccordionPartAppearance {
        fun c(v:String?)=v?.takeIf { it.matches(Regex("#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?")) }?.uppercase(java.util.Locale.ROOT)
        fun p(v:Double?)=v?.takeIf { it.isFinite() && it>=0 }
        return AWCAccordionPartAppearance(c(color),c(backgroundColor),c(borderColor),p(borderWidth),cornerShape,padding?.takeIf { it.valid },
            margin?.takeIf { m-> listOf(m.top,m.right,m.bottom,m.left).all(Double::isFinite) },p(width),p(height),p(minHeight),
            opacity?.takeIf(Double::isFinite)?.coerceIn(0.0,1.0),p(gap),p(fontSize),p(lineHeight),fontWeight?.takeIf { it.isFinite() && it in 1.0..1000.0 },
            letterSpacing?.takeIf(Double::isFinite))
    }
    fun merged(local:AWCAccordionPartAppearance):AWCAccordionPartAppearance { val a=normalized();val b=local.normalized()
        return AWCAccordionPartAppearance(b.color ?: a.color,b.backgroundColor ?: a.backgroundColor,b.borderColor ?: a.borderColor,b.borderWidth ?: a.borderWidth,
            b.cornerShape ?: a.cornerShape,b.padding ?: a.padding,b.margin ?: a.margin,b.width ?: a.width,b.height ?: a.height,b.minHeight ?: a.minHeight,
            b.opacity ?: a.opacity,b.gap ?: a.gap,b.fontSize ?: a.fontSize,b.lineHeight ?: a.lineHeight,b.fontWeight ?: a.fontWeight,b.letterSpacing ?: a.letterSpacing) }
    internal val border get()=borderWidth ?: 0.0
    companion object {
        fun fromValues(values:Map<String,AWCValue>):AWCAccordionPartAppearance {
            fun n(k:String)=(values[k] as? Number)?.toDouble()
            fun s(k:String)=values[k] as? String
            fun edges(k:String):AWCAccordionInsets? {
                val m=values[k] as? Map<*,*> ?: return null
                if(m.keys.any { it !in setOf("top","right","bottom","left") }) return null
                val e=listOf("top","right","bottom","left").map { (m[it] as? Number)?.toDouble() ?: return null }
                return AWCAccordionInsets(e[0],e[1],e[2],e[3])
            }
            return AWCAccordionPartAppearance(s("color"),s("backgroundColor"),s("borderColor"),n("borderWidth"),AWCCornerShape.fromValues(values["cornerShape"]),
                edges("padding"),edges("margin"),n("width"),n("height"),n("minHeight"),n("opacity"),n("gap"),n("fontSize"),n("lineHeight"),n("fontWeight"),n("letterSpacing")).normalized()
        }
    }
}
internal val LocalAWCAccordionItemParts=staticCompositionLocalOf { emptyMap<AWCAccordionItemPart,AWCAccordionPartAppearance>() }
/** Part styling inherits into nested scopes; wrap one item to target only that item. */
@Composable fun AWCAccordionItemPartAppearanceScope(part:AWCAccordionItemPart,appearance:AWCAccordionPartAppearance,content:@Composable ()->Unit) {
    val inherited=LocalAWCAccordionItemParts.current
    val resolved=remember(inherited,part,appearance) { inherited+(part to (inherited[part] ?: AWCAccordionPartAppearance()).merged(appearance)) }
    CompositionLocalProvider(LocalAWCAccordionItemParts provides resolved,content=content)
}
/** CSS margin collapsing of adjoining vertical margins: largest positive plus most negative. */
internal fun accordionCollapsedMargin(vararg margins:Double)=(margins.filter { it>0 }.maxOrNull() ?: 0.0)+(margins.filter { it<0 }.minOrNull() ?: 0.0)
