package dev.awc.nativeui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.remember
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.unit.dp

/** md-menu's CSS parts (CEM order). */
enum class AWCMenuPart(val source:String) { EmptyText("empty-text"), Surface("surface"), MenuViewport("menu-viewport") }
/** md-menu-item's CSS parts (CEM order). */
enum class AWCMenuItemPart(val source:String) {
    StateLayer("state-layer"), LeadingIcon("leading-icon"), Content("content"), Headline("headline"), SupportingText("supporting-text"), Badge("badge"), Trailing("trailing")
}
/** md-sub-menu-item's CSS parts (CEM order). */
enum class AWCSubMenuItemPart(val source:String) {
    StateLayer("state-layer"), LeadingIcon("leading-icon"), Content("content"), Headline("headline"), SupportingText("supporting-text"), Badge("badge")
}

/**
 * The `::part()` declarations with native meaning on the md-menu family's parts. Part rules come from the outer tree, so a
 * declared field wins over the hooks and every internal state rule (a state-layer [opacity] holds in every interaction state;
 * disabled rows still multiply their own 0.38). Colours are #RRGGBB or #RRGGBBAA, lengths dp; invalid values are ignored.
 * - [background]: the part's fill. Surface, state layer and badge: replaces the role colour; other parts paint it behind their box.
 * - [color]: the part's ink. On `content` it reaches the headline (CSS inheritance); the supporting text keeps its own colour rule.
 * - [outlineColor] / [outlineWidth]: a CSS outline around the part box (outside it, no layout effect).
 * - [cornerRadius]: the border radius of the part's fill and outline (surface: the surface shape and its shadow).
 * - [opacity]: the part's opacity (state layer: replaces the interaction-state opacity).
 * - [letterSpacing]: extra advance after every character of the part's text.
 */
@Immutable data class AWCMenuPartAppearance(
    val background:String?=null,val color:String?=null,val outlineColor:String?=null,val outlineWidth:Double?=null,
    val cornerRadius:Double?=null,val opacity:Double?=null,val letterSpacing:Double?=null,
) {
    internal fun normalized():AWCMenuPartAppearance {
        fun c(v:String?)=v?.takeIf { it.matches(Regex("#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?")) }?.uppercase(java.util.Locale.ROOT)
        fun p(v:Double?)=v?.takeIf { it.isFinite() && it>=0 }
        return AWCMenuPartAppearance(c(background),c(color),c(outlineColor),p(outlineWidth),p(cornerRadius),opacity?.takeIf(Double::isFinite)?.coerceIn(0.0,1.0),
            letterSpacing?.takeIf(Double::isFinite))
    }
    fun merged(local:AWCMenuPartAppearance):AWCMenuPartAppearance { val a=normalized();val b=local.normalized()
        return AWCMenuPartAppearance(b.background ?: a.background,b.color ?: a.color,b.outlineColor ?: a.outlineColor,b.outlineWidth ?: a.outlineWidth,
            b.cornerRadius ?: a.cornerRadius,b.opacity ?: a.opacity,b.letterSpacing ?: a.letterSpacing) }
    companion object {
        /** Laboratory / JSON form: `{"background": "#RRGGBB[AA]", "outlineWidth": 2, …}`; unknown keys and invalid values are ignored. */
        fun fromValues(values:Map<String,AWCValue>):AWCMenuPartAppearance {
            fun n(k:String)=(values[k] as? Number)?.toDouble()
            fun s(k:String)=values[k] as? String
            return AWCMenuPartAppearance(s("background"),s("color"),s("outlineColor"),n("outlineWidth"),n("cornerRadius"),n("opacity"),n("letterSpacing")).normalized()
        }
    }
}

/** Declared part appearances: per part for every element of the tag, and per element ID (`#id::part(x)`, which outranks the tag rule field by field). */
@Immutable internal data class AWCMenuPartStyles(val menu:Map<String,AWCMenuPartAppearance> =emptyMap(),val item:Map<String,AWCMenuPartAppearance> =emptyMap(),
                                                 val sub:Map<String,AWCMenuPartAppearance> =emptyMap()) {
    fun menu(part:AWCMenuPart,id:String)=resolve(menu,part.source,id)
    fun row(part:String,id:String,sub:Boolean)=resolve(if(sub) this.sub else item,part,id)
    companion object {
        fun key(part:String,id:String?)=if(id==null) part else "$id\u0001$part"
        fun resolve(d:Map<String,AWCMenuPartAppearance>,part:String,id:String):AWCMenuPartAppearance? {
            val g=d[part];val t=d[key(part,id)]
            return when { g==null -> t;t==null -> g;else -> g.merged(t) }
        }
    }
}
internal val LocalAWCMenuParts=staticCompositionLocalOf { AWCMenuPartStyles() }
private fun MutableMap<String,AWCMenuPartAppearance>.add(key:String,value:AWCMenuPartAppearance) { this[key]=(this[key] ?: AWCMenuPartAppearance()).merged(value) }

/** `md-menu::part(<part>)` styling for descendant menus (flyouts included), or `#menuID::part(<part>)` for one menu. */
@Composable fun AWCMenuPartAppearanceScope(part:AWCMenuPart,appearance:AWCMenuPartAppearance,menuID:String?=null,content:@Composable ()->Unit) {
    val outer=LocalAWCMenuParts.current
    val styles=remember(outer,part,appearance,menuID) { outer.copy(menu=outer.menu.toMutableMap().apply { add(AWCMenuPartStyles.key(part.source,menuID),appearance) }) }
    CompositionLocalProvider(LocalAWCMenuParts provides styles,content=content)
}
/** `md-menu-item::part(<part>)` styling for descendant rows, or `#itemID::part(<part>)` for one row. */
@Composable fun AWCMenuItemPartAppearanceScope(part:AWCMenuItemPart,appearance:AWCMenuPartAppearance,itemID:String?=null,content:@Composable ()->Unit) {
    val outer=LocalAWCMenuParts.current
    val styles=remember(outer,part,appearance,itemID) { outer.copy(item=outer.item.toMutableMap().apply { add(AWCMenuPartStyles.key(part.source,itemID),appearance) }) }
    CompositionLocalProvider(LocalAWCMenuParts provides styles,content=content)
}
/** `md-sub-menu-item::part(<part>)` styling for descendant submenu rows, or `#itemID::part(<part>)` for one row. */
@Composable fun AWCSubMenuItemPartAppearanceScope(part:AWCSubMenuItemPart,appearance:AWCMenuPartAppearance,itemID:String?=null,content:@Composable ()->Unit) {
    val outer=LocalAWCMenuParts.current
    val styles=remember(outer,part,appearance,itemID) { outer.copy(sub=outer.sub.toMutableMap().apply { add(AWCMenuPartStyles.key(part.source,itemID),appearance) }) }
    CompositionLocalProvider(LocalAWCMenuParts provides styles,content=content)
}

/** A part's declared opacity, fill (behind the box) and outline (outside it); the renderer applies the part's ink. */
internal fun Modifier.menuPartBox(part:AWCMenuPartAppearance?,fill:Boolean=true,applyOpacity:Boolean=true):Modifier {
    part ?: return this
    val alpha=part.opacity
    return this.then(if(applyOpacity && alpha!=null) Modifier.graphicsLayer { this.alpha=alpha.toFloat() } else Modifier).drawBehind {
        val r=(part.cornerRadius ?: 0.0).dp.toPx()
        if(fill) part.background?.let { drawRoundRect(statusDotColor(it),cornerRadius=CornerRadius(r,r)) }
        val w=(part.outlineWidth ?: 0.0).dp.toPx()
        if(w>0f) drawRoundRect(statusDotColor(part.outlineColor ?: part.color ?: "#000000"),topLeft=Offset(-w/2,-w/2),size=Size(size.width+w,size.height+w),
            cornerRadius=CornerRadius(r+w/2,r+w/2),style=Stroke(w))
    }
}

internal val LocalAWCMenuInlineFill=staticCompositionLocalOf { false }
/**
 * The inline-fill embedding (the source's `md-menu--inline-fill` host class, md-date-picker's docked panel): descendant anchorless
 * menus fill this scope's bounds without shadow, padding or corner radius except the end corners
 * (`--md-menu-inline-fill-radius-end`, [AWCMenuAppearance.inlineFillRadiusEnd]), on `--md-menu-inline-surface-color`
 * ([AWCMenuAppearance.inlineSurfaceColor], transparent by default), bounded by the scope instead of the height cap.
 */
@Composable fun AWCMenuInlineFillScope(enabled:Boolean=true,content:@Composable ()->Unit) {
    CompositionLocalProvider(LocalAWCMenuInlineFill provides enabled,content=content)
}
