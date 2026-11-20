package dev.awc.nativeui

import androidx.compose.runtime.*
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import kotlin.math.max
import kotlin.math.min

// md-menu family: source model, hooks, metrics and placement (md-menu.tsx / md-menu.css, md-menu-item.css,
// md-sub-menu-item.css, md-menu-item-group.css). Pure data, shared with the SwiftUI renderer (MenuSupport.swift).

/** CSS length with the units the source hooks accept here: px, bare numbers (px), vh, vw, dvh and %. */
internal data class NativeMenuLength(val value:Double,val unit:String) {
    fun resolve(viewport:Size,percentBase:Double=0.0)=when(unit) { "vh"->value*viewport.height/100;"vw"->value*viewport.width/100;"%"->value*percentBase/100;else->value }
    companion object {
        fun parse(raw:String?):NativeMenuLength? {
            val s=raw?.trim()?.takeIf { it.isNotEmpty() } ?: return null
            s.toDoubleOrNull()?.let { return NativeMenuLength(it,"px") }
            for(u in listOf("px","vh","vw","dvh","%")) if(s.endsWith(u)) {
                val n=s.dropLast(u.length).trim().toDoubleOrNull() ?: return null
                return NativeMenuLength(n,if(u=="dvh") "vh" else u)
            }
            return null
        }
    }
}

/** The md-menu and md-menu-item CSS custom properties (hooks). Values are CSS lengths; colours are hex. */
@Immutable data class AWCMenuAppearance(
    val minWidth:String?=null,val maxWidth:String?=null,val maxBlockSize:String?=null,val viewportMargin:String?=null,
    val groupGap:String?=null,val sectionGap:String?=null,val groupShape:String?=null,val groupContainerShape:String?=null,
    val inlineSurfaceColor:String?=null,val inlineFillRadiusEnd:String?=null,
    val itemHeight:String?=null,val itemPaddingInline:String?=null,val itemGap:String?=null,val itemIconSize:String?=null,val itemCheckSize:String?=null,
) {
    internal fun get(name:String):String?=when(name) {
        "min-width"->minWidth;"max-width"->maxWidth;"max-block-size"->maxBlockSize;"viewport-margin"->viewportMargin
        "group-gap"->groupGap;"section-gap"->sectionGap;"group-shape"->groupShape;"group-container-shape"->groupContainerShape
        "inline-surface-color"->inlineSurfaceColor;"inline-fill-radius-end"->inlineFillRadiusEnd
        "item-height"->itemHeight;"item-padding-inline"->itemPaddingInline;"item-gap"->itemGap;"item-icon-size"->itemIconSize;"item-check-size"->itemCheckSize
        else->null }
    private fun with(name:String,v:String?):AWCMenuAppearance=when(name) {
        "min-width"->copy(minWidth=v);"max-width"->copy(maxWidth=v);"max-block-size"->copy(maxBlockSize=v);"viewport-margin"->copy(viewportMargin=v)
        "group-gap"->copy(groupGap=v);"section-gap"->copy(sectionGap=v);"group-shape"->copy(groupShape=v);"group-container-shape"->copy(groupContainerShape=v)
        "inline-surface-color"->copy(inlineSurfaceColor=v);"inline-fill-radius-end"->copy(inlineFillRadiusEnd=v)
        "item-height"->copy(itemHeight=v);"item-padding-inline"->copy(itemPaddingInline=v);"item-gap"->copy(itemGap=v);"item-icon-size"->copy(itemIconSize=v);"item-check-size"->copy(itemCheckSize=v)
        else->this }
    /** Inherited CSS custom properties: the inner (more specific) value wins. */
    internal fun merging(inner:AWCMenuAppearance):AWCMenuAppearance { var out=this;for(n in names) inner.get(n)?.let { out=out.with(n,it) };return out }
    companion object {
        /** Hook names without the `--md-menu-` prefix, in source order. */
        val names=listOf("min-width","max-width","max-block-size","viewport-margin","group-gap","section-gap","group-shape","group-container-shape",
            "inline-surface-color","inline-fill-radius-end","item-height","item-padding-inline","item-gap","item-icon-size","item-check-size")
        /** From authored CSS custom properties (`--md-menu-*` names); unknown names are ignored. */
        fun fromCss(css:Map<String,String>):AWCMenuAppearance { var a=AWCMenuAppearance();for(n in names) css["--md-menu-$n"]?.let { a=a.with(n,it) };return a }
        /** Laboratory values: field names (`itemHeight`) or hook names without the prefix (`item-height`); a number is a
         *  px length, a string a CSS length (`inline-surface-color`: #RRGGBB[AA]). Null when a key or value is invalid. */
        fun fromValues(values:Map<String,Any?>):AWCMenuAppearance? {
            var a=AWCMenuAppearance()
            for((key,v) in values) {
                val k=if(key.contains('-')) key else key.replace(Regex("([A-Z])")) { "-"+it.value.lowercase() }
                if(k !in names) return null
                val s=when(v) { is Number->{ val n=v.toDouble();if(!n.isFinite() || n<0) return null;(if(n==Math.floor(n) && Math.abs(n)<1e15) n.toLong().toString() else n.toString())+"px" }
                    is String->v.trim();else->return null }
                if(k=="inline-surface-color") { if(!Regex("^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$").matches(s)) return null }
                else if(NativeMenuLength.parse(s)==null) return null
                a=a.with(k,s)
            }
            return a
        }
    }
}
internal val LocalAWCMenuAppearance=staticCompositionLocalOf { AWCMenuAppearance() }
internal val LocalAWCMenuReducedMotion=staticCompositionLocalOf<Boolean?> { null }
/** md-menu / md-menu-item hooks for every menu in [content] (inner scopes override outer ones per hook). */
@Composable fun AWCMenuAppearanceScope(appearance:AWCMenuAppearance,content:@Composable ()->Unit) {
    val outer=LocalAWCMenuAppearance.current
    CompositionLocalProvider(LocalAWCMenuAppearance provides outer.merging(appearance),content=content)
}
/** Test and preview override of the reduced-motion preference for menus (null follows the system animator setting). */
@Composable fun AWCMenuReducedMotionScope(reduced:Boolean?,content:@Composable ()->Unit) {
    CompositionLocalProvider(LocalAWCMenuReducedMotion provides reduced,content=content)
}

/** md-menu properties (source defaults). */
internal data class NativeMenuModel(
    val open:Boolean=false,val anchor:String="",val placement:String="bottom-start",val quick:Boolean=false,val variant:String="baseline",
    val layout:String="standard",val useGap:Boolean=false,val emptyText:String="",val matchAnchorWidth:Boolean=false,val responsive:Boolean=false,
    val persistent:Boolean=false,val autoFocus:Boolean=true,val maxHeight:String?=null,val listLabel:String="",val listbox:Boolean=false,
    val density:Double?=null,val hidden:Boolean=false,
) {
    /** `md-menu--grouped` exists only for the standard and vibrant variants. */
    val grouped get()=variant!="baseline" && layout=="grouped"
    val groupedGapCards get()=grouped && useGap
    companion object {
        fun from(p:Props):NativeMenuModel {
            val pl=p.str("placement");val v=p.str("variant")
            val mh=(p["maxHeight"] as? Number)?.toDouble()?.let { NativeMenuNumber.css(it) } ?: p.str("maxHeight").takeIf { it.isNotEmpty() }
            return NativeMenuModel(p.bool("open"),p.str("anchor"),if(pl in listOf("bottom-start","bottom-end","top-start","top-end")) pl else "bottom-start",
                p.bool("quick"),if(v in listOf("baseline","standard","vibrant")) v else "baseline",if(p.str("layout")=="grouped") "grouped" else "standard",
                p.bool("useGap"),p.str("emptyText"),p.bool("matchAnchorWidth"),p.bool("responsive"),p.bool("persistent"),p.bool("autoFocus",true),mh,
                p.str("listLabel"),p.bool("listbox"),(p["density"] as? Number)?.toDouble(),p.bool("hidden"))
        }
    }
}
internal object NativeMenuNumber { fun css(v:Double)=if(v==Math.floor(v) && !v.isInfinite()) v.toLong().toString() else v.toString() }

/** md-menu-item / md-sub-menu-item properties. */
internal data class NativeMenuItemModel(
    val sub:Boolean=false,val headline:String="",val supportingText:String="",val trailingText:String="",val disabled:Boolean=false,
    val selected:Boolean=false,val indeterminate:Boolean=false,val keepOpen:Boolean=false,val divider:Boolean=false,val gap:Boolean=false,
    val badge:String="",val type:String="button",val checkPosition:String="end",val presentation:String="menuitem",val roleOverride:String="",
    val density:Double?=null,val openDelay:Double=100.0,val closeDelay:Double=400.0,val hidden:Boolean=false,val id:String="",
) {
    val role:String get()=when { roleOverride.isNotEmpty()->roleOverride;presentation=="option"->"option"
        type=="checkbox"->"menuitemcheckbox";type=="radio"->"menuitemradio";else->"menuitem" }
    /** The row's accessible name: its text content as Chrome computes it (headline, supporting text, badge and, without
     *  a slotted trailing icon, the trailing text; the check, icons and arrow are aria-hidden). */
    fun accessibleName(trailingSlot:Boolean=false)=listOf(headline,supportingText,badge,if(sub || trailingSlot) "" else trailingText)
        .map { it.trim().replace(Regex("[\\t\\n\\r\\u000C ]+")," ") }.filter { it.isNotEmpty() }.joinToString(" ")
    /** aria-checked: "mixed" for indeterminate (not selected) checkbox/radio rows, absent for buttons and options. */
    val ariaChecked:String? get()=if(presentation=="option" || type=="button") null else if(indeterminate && !selected) "mixed" else selected.toString()
    val checkGlyph:String get()=if(selected) "check" else if(indeterminate) "remove" else ""
    companion object {
        fun from(tag:String,p:Props):NativeMenuItemModel {
            val sub=tag=="md-sub-menu-item";val t=p.str("type")
            fun d(k:String,f:Double)=(p[k] as? Number)?.toDouble()?.takeIf { it.isFinite() } ?: f
            return NativeMenuItemModel(sub,p.str("headline"),p.str("supportingText"),if(sub) "" else p.str("trailingText"),p.bool("disabled"),
                !sub && p.bool("selected"),!sub && p.bool("indeterminate"),p.bool("keepOpen"),p.bool("divider"),p.bool("gap"),p.str("badge"),
                if(sub) "button" else if(t=="checkbox" || t=="radio") t else "button",if(p.str("checkPosition")=="start") "start" else "end",
                if(p.str("presentation")=="option") "option" else "menuitem",p.str("roleOverride"),(p["density"] as? Number)?.toDouble(),
                d("openDelay",100.0),d("closeDelay",400.0),p.bool("hidden"),p.str("id"))
        }
    }
}

/** Spacing tokens per density rung (md3.css `[density]` / `[data-density]` rules for -2…-4). */
internal class NativeMenuSpacing(rung:Double) {
    val insetXS=4.0;val insetSM=if(rung<=-3) 4.0 else 8.0;val insetMD=if(rung<=-2) 8.0 else 12.0
    val insetLG=if(rung<=-4) 8.0 else if(rung<=-2) 12.0 else 16.0
    val gapXS=if(rung<=-4) 2.0 else 4.0;val gapMD=if(rung<=-4) 4.0 else if(rung<=-2) 8.0 else 12.0
}

/** Row metrics of md-menu-item / md-sub-menu-item for a density scale, variant and hooks. */
internal data class NativeMenuRowMetrics(val height:Double,val paddingInline:Double,val gap:Double,val iconSize:Double,val checkSize:Double,
                                         val headlineSize:Double,val headlineLine:Double,val supportingSize:Double,val supportingLine:Double) {
    companion object {
        fun of(d:Double,rung:Double,variant:String,sub:Boolean,a:AWCMenuAppearance,viewport:Size):NativeMenuRowMetrics {
            val sp=NativeMenuSpacing(rung);val styled=variant!="baseline"
            fun len(s:String?)=if(sub) null else NativeMenuLength.parse(s)?.resolve(viewport)
            // Submenu rows ignore the --md-menu-item-* hooks (documented in their readme; a decision recorded in the source review).
            return NativeMenuRowMetrics(len(a.itemHeight) ?: (48+d*4),len(a.itemPaddingInline) ?: sp.insetMD,len(a.itemGap) ?: (if(styled) 8.0 else sp.gapMD),
                len(a.itemIconSize) ?: (if(styled) max(16.0,20+d) else max(18.0,24+d)),len(a.itemCheckSize) ?: max(16.0,20+d),
                max(13.0,16+d*.5),max(18.0,24+d),max(11.0,14+d*.5),max(16.0,20+d))
        }
    }
}

/** Logical corner radii (start-start, start-end, end-start, end-end) of a row in the standard / vibrant variants. */
internal data class NativeMenuRowCorners(val ss:Double,val se:Double,val es:Double,val ee:Double) {
    val values get()=listOf(ss,se,es,ee)
    companion object {
        fun all(r:Double)=NativeMenuRowCorners(r,r,r,r)
        /** Physical order (top-left, top-right, bottom-right, bottom-left) of logical values [ss, se, es, ee]. */
        fun physical(v:List<Double>,rtl:Boolean)=if(rtl) listOf(v[1],v[0],v[2],v[3]) else listOf(v[0],v[1],v[3],v[2])
        /** md-menu.css `::slotted` rules (direct menu children; they win over the row's own `:host` rules) and
         *  md-menu-item.css / md-sub-menu-item.css `:host` rules (rows inside groups). */
        fun resolve(variant:String,first:Boolean,last:Boolean,afterGap:Boolean,gap:Boolean,directChild:Boolean,
                    hover:Boolean,active:Boolean,selected:Boolean,sub:Boolean):NativeMenuRowCorners {
            if(variant=="baseline") return all(0.0)
            val small=8.0;val large=16.0;val xs=4.0;val medium=12.0
            var r=all(small);if(first) r=r.copy(ss=large,se=large);if(last) r=r.copy(es=large,ee=large)
            if(directChild) {
                // Source order inside md-menu.css: hover < active/selected < first:hover < last:hover < first:last:hover.
                if(hover) r=all(xs)
                if(active || (selected && !sub)) r=all(medium)
                if(hover && first && last) r=all(large)
                else if(hover && first) r=NativeMenuRowCorners(large,large,xs,xs)
                else if(hover && last) r=NativeMenuRowCorners(xs,xs,large,large)
                return r
            }
            // :host rules: selected < hover < active < first:hover < last:hover < first:last:hover < after-gap:hover < gap:hover < after-gap:gap:hover.
            if(selected && !sub) r=all(medium)
            if(hover) r=all(xs)
            if(active) r=all(medium)
            if(hover && first) r=NativeMenuRowCorners(large,large,xs,xs)
            if(hover && last) r=NativeMenuRowCorners(xs,xs,large,large)
            if(hover && first && last) r=all(large)
            if(hover && afterGap) r=NativeMenuRowCorners(large,large,xs,xs)
            if(hover && gap) r=NativeMenuRowCorners(xs,xs,large,large)
            if(hover && afterGap && gap) r=all(large)
            return r
        }
    }
}

/** Colours of the three menu variants (md-menu.css surfaces, md-menu-item.css / md-sub-menu-item.css rows). */
internal class NativeMenuPalette(private val tokens:Map<String,String>) {
    private fun c(name:String,fallback:String)=tokens["--md-sys-color-$name"] ?: fallback
    fun surface(variant:String)=when(variant) { "standard"->c("surface-container-low","#F7F2FA");"vibrant"->c("tertiary-container","#FFD8E4");else->c("surface-container","#F3EDF7") }
    fun ink(variant:String,selected:Boolean)=when {
        selected && variant=="standard"->c("on-tertiary-container","#31111D");selected && variant=="vibrant"->c("on-tertiary","#FFFFFF")
        variant=="vibrant"->c("on-tertiary-container","#31111D");else->c("on-surface","#1D1B20") }
    /** Leading icon, trailing, supporting text and submenu arrow; selected rows inherit the row ink. */
    fun secondaryInk(variant:String,selected:Boolean)=if(selected) ink(variant,true) else if(variant=="vibrant") c("on-tertiary-container","#31111D") else c("on-surface-variant","#49454F")
    fun selectedFill(variant:String)=when(variant) { "standard"->c("tertiary-container","#FFD8E4");"vibrant"->c("tertiary","#7D5260");else->c("secondary-container","#E8DEF8") }
    fun stateLayer(variant:String)=if(variant=="vibrant") c("on-tertiary-container","#31111D") else c("on-surface","#1D1B20")
    val focusRing get()=c("secondary","#625B71")
    val divider get()=c("outline-variant","#CAC4D0")
    val badgeFill get()=c("tertiary-container","#FFD8E4")
    val badgeInk get()=c("on-tertiary-container","#31111D")
    val emptyInk get()=c("on-surface-variant","#49454F")
    val groupLabel get()=c("on-surface-variant","#49454F")
    companion object {
        fun surfaceShadow(variant:String)=if(variant=="baseline") NativeShadowLayer.parse("0 1px 2px 0 rgba(0,0,0,.3), 0 2px 6px 2px rgba(0,0,0,.15)")
            else NativeShadowLayer.parse("0 1px 3px 0 rgba(0,0,0,.12), 0 4px 8px 3px rgba(0,0,0,.08)")
        /** Grouped cards: box-shadow on each group when the menu has a submenu (also the per-card stand-in for the surface's drop-shadow filter). */
        val groupShadow get()=NativeShadowLayer.parse("0 1px 2px 0 rgba(0,0,0,.15), 0 2px 6px 0 rgba(0,0,0,.1)")
    }
}

/** md-menu `positionMenu()`: placement, flips, viewport clamp, responsive sheet and the scroll cap. Values in dp. */
internal data class NativeMenuPlacement(val x:Double,val y:Double,val width:Double,val cap:Double,val vertical:String,val horizontal:String,val responsive:Boolean) {
    /** Transform origin of the open / close motion (physical, as the source writes it). */
    val originX get()=if(horizontal=="start") 0f else 1f
    val originY get()=if(vertical=="bottom") 0f else 1f
    companion object {
        /** `max-block-size: min(<max-height> | var(--md-menu-max-block-size, 250px), 100dvh - 2 × margin)`. */
        fun defaultCap(model:NativeMenuModel,a:AWCMenuAppearance,viewport:Size,margin:Double):Double {
            val mh=NativeMenuLength.parse(model.maxHeight)?.resolve(viewport)
            val hook=NativeMenuLength.parse(a.maxBlockSize)?.resolve(viewport) ?: 250.0
            return min(mh ?: hook,viewport.height-2*margin)
        }
        /** `--md-menu-section-gap` (default 2px): the space under a row marked `gap` in a sectioned baseline menu. */
        fun sectionGap(a:AWCMenuAppearance,viewport:Size)=NativeMenuLength.parse(a.sectionGap)?.resolve(viewport) ?: 2.0
        fun margin(a:AWCMenuAppearance,viewport:Size)=NativeMenuLength.parse(a.viewportMargin)?.resolve(viewport) ?: 8.0
        /** Surface width before the vertical pass: the responsive sheet, or the measured width widened to the anchor. */
        fun width(anchor:Rect?,surfaceWidth:Double,viewport:Size,model:NativeMenuModel,a:AWCMenuAppearance):Double {
            val m=margin(a,viewport)
            if(model.responsive && viewport.width<=600) return viewport.width-2*m
            return if(model.matchAnchorWidth && anchor!=null) max(surfaceWidth,anchor.width.toDouble()) else surfaceWidth
        }
        /** [chrome] is the surface height outside the scroll viewport (padding + header), [content] the viewport's natural height. */
        fun resolve(anchor:Rect,surfaceWidth:Double,chrome:Double,content:Double,viewport:Size,model:NativeMenuModel,a:AWCMenuAppearance):NativeMenuPlacement {
            val gap=4.0;val vw=viewport.width.toDouble();val vh=viewport.height.toDouble()
            // positionMenu() clamps with VIEWPORT_MARGIN (8); --md-menu-viewport-margin sizes the CSS caps (max-width, max-block-size).
            val hm=margin(a,viewport);val m=8.0
            val baseCap=defaultCap(model,a,viewport,hm)
            fun height(cap:Double)=chrome+min(content,cap)
            val top0=anchor.top.toDouble();val bottom0=anchor.bottom.toDouble();val left0=anchor.left.toDouble();val right0=anchor.right.toDouble()
            if(model.responsive && vw<=600) {
                val w=vw-2*hm;val h=height(baseCap)
                var top=bottom0+gap;var vertical="bottom"
                if(top+h+m>vh && top0-gap-h>=m) { top=top0-gap-h;vertical="top" }
                top=max(m,min(top,vh-h-m))
                return NativeMenuPlacement(m,top,w,baseCap,vertical,"start",true)
            }
            val w=if(model.matchAnchorWidth) max(surfaceWidth,anchor.width.toDouble()) else surfaceWidth
            var vertical=if(model.placement.startsWith("bottom")) "bottom" else "top";var horizontal=if(model.placement.endsWith("start")) "start" else "end"
            val menuH0=height(baseCap)
            val below=vh-bottom0-gap-m;val above=top0-gap-m
            if(vertical=="bottom" && menuH0>below) { if(menuH0<=above || above>below) vertical="top" }
            else if(vertical=="top" && menuH0>above) { if(menuH0<=below || below>above) vertical="bottom" }
            if(horizontal=="start" && left0+w>vw) { if(right0-w>=0) horizontal="end" }
            else if(horizontal=="end" && right0-w<0) { if(left0+w<=vw) horizontal="start" }
            val avail=if(vertical=="bottom") below else above
            val cap=min(baseCap,max(48.0,avail-chrome))
            val menuH=height(cap)
            val top=if(vertical=="bottom") bottom0+gap else top0-gap-menuH
            val left=if(horizontal=="start") left0 else right0-w
            return NativeMenuPlacement(max(m,min(left,vw-w-m)),max(m,min(top,vh-menuH-m)),w,cap,vertical,horizontal,false)
        }
        /** md-sub-menu-item `autoPositionSubmenu()`: inline-end of the row, flipped to inline-start when only that fits; clamped. */
        fun submenu(row:Rect,width:Double,height:Double,viewport:Size,rtl:Boolean):Pair<Double,Double> {
            val w=if(width>0) width else 200.0;val h=if(height>0) height else 200.0;val vw=viewport.width.toDouble();val vh=viewport.height.toDouble();val m=8.0
            val endLeft=if(rtl) row.left-w else row.right.toDouble();val startLeft=if(rtl) row.right.toDouble() else row.left-w
            fun fits(l:Double)=l>=0 && l+w<=vw
            var left=endLeft;if(!fits(endLeft) && fits(startLeft)) left=startLeft
            var top=row.top.toDouble();if(top+h>vh) top=row.bottom-h
            return max(m,min(left,vw-w-m)) to max(m,min(top,vh-h-m))
        }
    }
}

/** Typeahead (500 ms buffer): a single character starts after the focused row; longer buffers include it. */
internal class NativeMenuTypeahead {
    var buffer="";private set
    private var last=Double.NEGATIVE_INFINITY
    fun next(char:String,now:Double,focused:Int,labels:List<String>):Int? {
        if(now-last>500) buffer=""
        last=now;buffer+=char.lowercase()
        val start=if(buffer.length==1) focused+1 else focused
        if(labels.isEmpty()) return null
        for(i in labels.indices) { val idx=((start+i)%labels.size+labels.size)%labels.size;if(labels[idx].lowercase().startsWith(buffer)) return idx }
        return null
    }
}
