package dev.awc.nativeui

import androidx.compose.runtime.*
import kotlin.math.max

/** The md-list-item CSS parts (CEM order). Part rules come from the outer tree, so a
 * native part appearance wins over the hooks and every internal state rule. */
enum class AWCListItemPart(val source:String) {
    Row("row"),StateLayer("state-layer"),Primary("primary"),Leading("leading"),Content("content"),Headline("headline"),Overline("overline"),
    SupportingText("supporting-text"),Trailing("trailing"),TrailingSupportingText("trailing-supporting-text"),LeadingIcon("leading-icon"),
    TrailingIcon("trailing-icon"),Avatar("avatar"),AvatarImage("avatar-image"),AvatarInitials("avatar-initials"),AvatarIcon("avatar-icon"),
    Image("image"),ImageWrap("image-wrap"),ImageSelectionIndicator("image-selection-indicator"),ImageSelectionCircle("image-selection-circle"),
    ImageSelectionCheck("image-selection-check"),ExpandButton("expand-button"),ExpandButtonStateLayer("expand-button-state-layer"),
    ExpandButtonIcon("expand-button-icon"),DragHandle("drag-handle"),ExpandedPanel("expanded-panel"),ExpandedPanelInner("expanded-panel-inner"),
    HeadlineTooltipPopup("headline-tooltip-popup"),SupportingTooltipPopup("supporting-tooltip-popup");
    companion object { fun fromSource(name:String)=entries.firstOrNull { it.source==name } }
}

internal val LocalAWCListAppearance=staticCompositionLocalOf { AWCListAppearance() }
internal val LocalAWCListItemAppearance=staticCompositionLocalOf { AWCListItemAppearance() }
internal val LocalAWCListItemAppearanceTargets=staticCompositionLocalOf { emptyMap<String,AWCListItemAppearance>() }
internal val LocalAWCListItemParts=staticCompositionLocalOf { emptyMap<AWCListItemPart,AWCAccordionPartAppearance>() }
internal val LocalAWCListPlaceholderPart=staticCompositionLocalOf<AWCAccordionPartAppearance?> { null }
internal val LocalAWCListShapeMorph=staticCompositionLocalOf { true }
internal val LocalAWCListReducedMotion=staticCompositionLocalOf<Boolean?> { null }
internal val LocalAWCListInspection=staticCompositionLocalOf<AWCListInspection?> { null }

/** md-list hooks for descendant lists. */
@Composable fun AWCListAppearanceScope(appearance:AWCListAppearance,content:@Composable ()->Unit) {
    val inherited=LocalAWCListAppearance.current
    CompositionLocalProvider(LocalAWCListAppearance provides inherited.merge(appearance.normalized()),content=content)
}
/**
 * md-list-item hooks. Without [id] the values are inherited by every descendant row (like setting
 * them on the list, so the list's per-position shape rules win over them); with [id] they are
 * declared on the row whose `id` property matches (inline style: they win over the list rules).
 */
@Composable fun AWCListItemAppearanceScope(appearance:AWCListItemAppearance,id:String?=null,content:@Composable ()->Unit) {
    if(id==null) { val inherited=LocalAWCListItemAppearance.current
        CompositionLocalProvider(LocalAWCListItemAppearance provides inherited.merge(appearance.normalized()),content=content) }
    else { val targets=LocalAWCListItemAppearanceTargets.current
        CompositionLocalProvider(LocalAWCListItemAppearanceTargets provides targets+(id to (targets[id] ?: AWCListItemAppearance()).merge(appearance.normalized())),content=content) }
}
/** `md-list-item::part(<part>)` styling for descendant rows. */
@Composable fun AWCListItemPartAppearanceScope(part:AWCListItemPart,appearance:AWCAccordionPartAppearance,content:@Composable ()->Unit) {
    val inherited=LocalAWCListItemParts.current
    CompositionLocalProvider(LocalAWCListItemParts provides inherited+(part to (inherited[part] ?: AWCAccordionPartAppearance()).merged(appearance)),content=content)
}
/** `md-list::part(drop-placeholder)` styling. */
@Composable fun AWCListPlaceholderPartAppearanceScope(appearance:AWCAccordionPartAppearance,content:@Composable ()->Unit) {
    CompositionLocalProvider(LocalAWCListPlaceholderPart provides appearance.normalized(),content=content)
}
/** `data-shape-morph="off"`: state shapes resolve to the resting corners. */
@Composable fun AWCListShapeMorphScope(enabled:Boolean,content:@Composable ()->Unit) { CompositionLocalProvider(LocalAWCListShapeMorph provides enabled,content=content) }
/** Forces reduced (true) or full (false) motion for descendant lists; null follows the system. */
@Composable fun AWCListReducedMotionScope(reduced:Boolean?,content:@Composable ()->Unit) { CompositionLocalProvider(LocalAWCListReducedMotion provides reduced,content=content) }

/**
 * Opt-in evidence of the resolved row style (tests and the Laboratory): per row `id`, the values
 * painted in the last drawn frame. UI-thread only; nothing is recorded outside the scope.
 */
class AWCListInspection {
    val rows=HashMap<String,Map<String,Any?>>()
    val lists=HashMap<String,Map<String,Any?>>()
    val events=mutableListOf<Pair<String,AWCValue>>()
    fun clear() { rows.clear();lists.clear();events.clear() }
}
@Composable fun AWCListInspectionScope(inspection:AWCListInspection,content:@Composable ()->Unit) { CompositionLocalProvider(LocalAWCListInspection provides inspection,content=content) }

/** md-list-item's property and class logic (md-list-item.tsx getters and render()). */
internal data class NativeListItemModel(val p:Props) {
    val type=p["type"]?.toString() ?: "text"
    val headline=p.str("headline");val overline=p.str("overline");val supportingText=p.str("supportingText");val trailingSupportingText=p.str("trailingSupportingText")
    val leadingIcon=p.str("leadingIcon");val trailingIcon=p.str("trailingIcon");val leadingAvatar=p.str("leadingAvatar");val leadingAvatarAlt=p.str("leadingAvatarAlt")
    val leadingAvatarName=p.str("leadingAvatarName");val leadingAvatarLabel=p.str("leadingAvatarLabel");val leadingImage=p.str("leadingImage");val leadingImageAlt=p.str("leadingImageAlt")
    val href=p.str("href");val target=p.str("target","_self")
    val lines=(p["lines"] as? Number)?.toDouble()?.takeIf { it==1.0 || it==2.0 || it==3.0 } ?: 1.0
    val disabled=p.bool("disabled");val softDisabled=p.bool("softDisabled");val selected=p.bool("selected");val expandable=p.bool("expandable");val expanded=p.bool("expanded")
    val hidden=p.bool("hidden");val density=(p["density"] as? Number)?.toDouble();val rovingFocusVisible=p.bool("rovingFocusVisible")
    val id=p.str("id")
    val hasAvatar get()=leadingAvatar.isNotEmpty() || leadingAvatarLabel.isNotEmpty() || leadingAvatarName.isNotEmpty()
}
internal data class NativeListItemStates(val hover:Boolean=false,val active:Boolean=false,val pressed:Boolean=false,val focusVisible:Boolean=false,val roving:Boolean=false,val dragged:Boolean=false)

/** What a hosting md-list (or a parent row's expanded panel) tells one row. */
internal data class NativeListItemContext(
    val listStyle:String="standard",val selectionMode:String="none",val interactionMode:String="single-action",val containerRole:String="list",
    val reorderable:Boolean=false,val hostList:Boolean=false,val first:Boolean=false,val last:Boolean=false,val index:Int=0,val childIndex:Int?=null,
    val inPanel:Boolean=false,val lastInLastExpanded:Boolean=false,
) { val inSelectionMode get()=selectionMode=="single-select" || selectionMode=="multi-select" }

/** md-list-item.css resolved rule by rule (specificity, then source order). */
internal class NativeListItemStyle(
    val model:NativeListItemModel,val ctx:NativeListItemContext?,val inline:AWCListItemAppearance,val inherited:AWCListItemAppearance,
    val tokens:Map<String,String>,val rtl:Boolean,val density:Double,val rung:Double,val selected:Boolean,val expanded:Boolean,
    val slottedOverline:Boolean,val slottedSupporting:Boolean,val leadingVideo:Boolean,val morph:Boolean,
) {
    val a=inherited.merge(inline)
    fun color(name:String,fallback:String)=tokens["--md-sys-color-$name"] ?: fallback
    val inList get()=ctx?.hostList ?: false
    val inSelection get()=ctx?.inSelectionMode ?: false
    val participates get()=inSelection && !model.expandable && ctx?.inPanel!=true
    val interactive get()=!model.disabled && (model.type!="text" || inSelection || model.expandable)
    val disabledClass get()=model.disabled || model.softDisabled
    val selectedClass get()=selected && !model.expandable
    val reorderable get()=ctx?.reorderable ?: false
    val lines:Int get() { if(model.lines!=1.0) return model.lines.toInt()
        val o=model.overline.isNotEmpty() || slottedOverline;val s=model.supportingText.isNotEmpty() || slottedSupporting
        return if(o && s) 3 else if(o || s) 2 else 1 }
    val hasPrimaryAction get()=!participates && !reorderable && ctx?.containerRole !in setOf("menu","menubar") && (model.type=="button" || model.type=="link")
    val expandableOnly get()=model.expandable && !participates && model.type=="text"
    val focusable get()=(interactive && !expandableOnly) || reorderable
    /** A stop of its list's roving focus (md-list isItemFocusable): in a selection list an expandable-only row is one too. */
    val rovingFocusable get()=if(inList && ctx?.inPanel!=true) !model.disabled && (inSelection || reorderable || model.type!="text") else focusable
    val onSurface get()=color("on-surface","#1C1B1F")
    val disabledInk get()=mix(onSurface,.38)
    val selectedLabel get()=a.selectedLabelTextColor ?: color("on-secondary-container","#4A4458")
    val containerColor:String get()=when {
        selectedClass && disabledClass->a.selectedDisabledContainerColor ?: mix(onSurface,.12)
        selectedClass->a.selectedContainerColor ?: color("secondary-container","#E8DEF8")
        else->a.containerColor ?: color("surface","#FEF7FF") }
    val labelColor get()=if(disabledClass) disabledInk else if(selectedClass) selectedLabel else a.labelTextColor ?: onSurface
    val supportingColor get()=if(disabledClass) disabledInk else if(selectedClass) selectedLabel else a.supportingTextColor ?: color("on-surface-variant","#49454F")
    val overlineColor get()=if(disabledClass) disabledInk else if(selectedClass) selectedLabel else a.overlineColor ?: color("on-surface-variant","#49454F")
    val trailingTextColor get()=if(disabledClass) disabledInk else if(selectedClass) selectedLabel else a.trailingSupportingTextColor ?: color("on-surface-variant","#49454F")
    fun isActive(s:NativeListItemStates)=interactive && (s.hover || s.focusVisible || s.roving || s.active || s.pressed || s.dragged)
    fun leadingIconColor(s:NativeListItemStates)=when {
        disabledClass->disabledInk
        selectedClass && (isActive(s) || s.pressed || s.dragged)->a.selectedActiveIconColor ?: color("on-surface","#1D1B20")
        selectedClass->selectedLabel
        else->a.leadingIconColor ?: color("on-surface-variant","#49454F") }
    fun trailingIconColor(s:NativeListItemStates)=when {
        disabledClass->disabledInk
        selectedClass && (isActive(s) || s.pressed || s.dragged)->a.selectedActiveIconColor ?: color("on-surface","#1D1B20")
        selectedClass->selectedLabel
        participates->a.unselectedTrailingIconColor ?: color("on-surface","#1D1B20")
        else->a.trailingIconColor ?: color("on-surface-variant","#49454F") }
    val chevronColor get()=if(disabledClass) disabledInk else a.expandChevronColor ?: color("on-surface-variant","#49454F")
    val stateLayerColor get()=if(selectedClass) selectedLabel else onSurface
    val layerVisible get()=interactive && !model.softDisabled
    fun layerOpacity(s:NativeListItemStates):Double = when {
        !interactive->0.0
        s.active->a.pressedStateLayerOpacity ?: .1
        s.roving->a.focusStateLayerOpacity ?: .1
        s.hover->a.hoverStateLayerOpacity ?: .08
        s.focusVisible->a.focusStateLayerOpacity ?: .1
        disabledClass->a.disabledStateLayerOpacity ?: 0.0
        s.dragged->a.draggedStateLayerOpacity ?: .16
        s.pressed->a.pressedStateLayerOpacity ?: .1
        else->0.0 }
    fun focusRing(s:NativeListItemStates)=interactive && (s.focusVisible || s.roving)
    /** Logical corners (start-start, start-end, end-start, end-end). */
    val restCorners:List<Double> get() {
        val segmented=ctx?.listStyle=="segmented";val panel=ctx?.inPanel==true
        fun shorthand(s:AWCCornerShape?)=s?.topLeft?.x?.points
        val listShorthand=ctx?.let { if(panel) 0.0 else if(it.listStyle=="segmented") 4.0 else 0.0 }
        val containerShape=shorthand(inline.containerShape) ?: listShorthand ?: shorthand(inherited.containerShape) ?: if(segmented) 4.0 else 0.0
        val slotted=arrayOfNulls<Double>(4)
        if(ctx!=null) { if(panel) { for(i in 0..3) slotted[i]=0.0;if(ctx.lastInLastExpanded) { slotted[2]=16.0;slotted[3]=16.0 } }
            else { if(ctx.first) { slotted[0]=16.0;slotted[1]=16.0 };if(ctx.last) { slotted[2]=16.0;slotted[3]=16.0 } } }
        val host=arrayOfNulls<Double>(4);if(model.expandable && expanded) { host[2]=0.0;host[3]=0.0 }
        val own=listOf(inline.containerShapeStartStart,inline.containerShapeStartEnd,inline.containerShapeEndStart,inline.containerShapeEndEnd)
        val inh=listOf(inherited.containerShapeStartStart,inherited.containerShapeStartEnd,inherited.containerShapeEndStart,inherited.containerShapeEndEnd)
        return (0..3).map { own[it] ?: slotted[it] ?: host[it] ?: inh[it] ?: containerShape }
    }
    fun stateShape(s:NativeListItemStates):Double? { val active=a.activeContainerShape;val m=if(morph) 1.0 else 0.0
        return when {
            s.roving && interactive->(a.focusContainerShape ?: active ?: 16.0)*m
            s.active && interactive->(a.pressedContainerShape ?: active ?: 16.0)*m
            s.focusVisible && interactive->(a.focusContainerShape ?: active ?: 16.0)*m
            s.dragged->a.draggedContainerShape ?: active ?: 16.0
            s.pressed->(a.pressedContainerShape ?: active ?: 16.0)*m
            selectedClass->(a.selectedContainerShape ?: active ?: 16.0)*m
            else->null } }
    fun corners(s:NativeListItemStates):List<Double> { val rest=restCorners;val shape=stateShape(s) ?: return rest;return rest.map { max(it,shape) } }
    /** [topLeft, topRight, bottomRight, bottomLeft] from logical corners. */
    fun physical(c:List<Double>)=if(rtl) listOf(c[1],c[0],c[2],c[3]) else listOf(c[0],c[1],c[3],c[2])
    fun insetLg(r:Double)=if(r<=-4) 8.0 else if(r<=-2) 12.0 else 16.0
    val leadingIconSize get()=a.leadingIconSize ?: if(inList) (a.leadingIconExpressiveSize ?: max(16.0,20+density)) else max(18.0,24+density)
    val trailingIconSize get()=a.trailingIconSize ?: if(inList) (a.trailingIconExpressiveSize ?: max(16.0,20+density)) else max(18.0,24+density)
    val imageShape get()=a.leadingImageShape ?: if(inList) (a.leadingImageExpressiveShape ?: 8.0) else 0.0
    data class Padding(val top:Double,val bottom:Double,val start:Double,val end:Double)
    val padding:Padding get() {
        var top=a.topSpace ?: max(2.0,8+density*1.5);var bottom=a.bottomSpace ?: max(2.0,8+density*1.5)
        if(leadingVideo) { top=a.leadingVideoTopSpace ?: max(4.0,12+density*2);bottom=max(4.0,12+density*2) }
        if(lines==3) { top=a.threeLineTopSpace ?: max(2.0,12+density*2.5);bottom=a.threeLineBottomSpace ?: max(2.0,12+density*2.5) }
        val start=if(model.leadingImage.isNotEmpty()) 16.0 else a.leadingSpace ?: insetLg(rung)
        return Padding(top,bottom,start,a.trailingSpace ?: insetLg(rung))
    }
    val gap get()=a.betweenSpace ?: max(8.0,if(rung<=-2) 8.0 else 12.0)
    val minHeight get()=if(lines==1) 56+density*4 else (if(lines==2) 72.0 else 88.0)+density*6
    val headlineSize get()=max(13.0,16+density*.5)
    val headlineLine get()=max(18.0,24+density)
    val supportingSize get()=max(11.0,14+density*.5)
    val supportingLine get()=max(16.0,20+density)
    companion object {
        fun mix(hex:String,alpha:Double):String { val c=statusDotColor(hex.uppercase())
            return "#%02X%02X%02X%02X".format(Math.round(c.red*255),Math.round(c.green*255),Math.round(c.blue*255),Math.round(c.alpha*alpha*255)) }
    }
}

// MARK: Methods

/** Native counterparts of md-list's methods; attach with [AWCListControllerScope] (by the list's `id`). */
@Stable class AWCListController {
    internal var owner:NativeListOwner? by mutableStateOf(null)
    val isConnected:Boolean get()=owner!=null
    /** Moves roving focus (visible ring) to the next focusable row, wrapping; returns its `id`. */
    fun activateNext():String?=owner?.step(1)
    /** Moves roving focus to the previous focusable row, wrapping; returns its `id`. */
    fun activatePrevious():String?=owner?.step(-1)
    /** Selects (single) or toggles (multi) the row at [index] without emitting `mdSelect`. */
    fun selectItem(index:Int) { owner?.selectSilently(index) }
    /** Indices of the selected rows in displayed order. */
    fun getSelectedIndices():List<Int> = owner?.selectedIndices() ?: emptyList()
}
/** Native counterparts of md-list-item's methods; attach with [AWCListItemControllerScope] (by the row's `id`). */
@Stable class AWCListItemController {
    internal var row:NativeListRow? by mutableStateOf(null)
    val isConnected:Boolean get()=row!=null
    /** `setFocus({ focusVisible })`: focuses the row; false when it cannot take focus. */
    fun setFocus(focusVisible:Boolean=false):Boolean=row?.focus(focusVisible) ?: false
    fun focusItem():Boolean=setFocus()
    /** Toggles `expanded` (no-op unless expandable and enabled; emits no `mdExpand`, like the source). */
    fun toggle() { row?.setExpanded?.invoke(null) }
    fun expand() { row?.setExpanded?.invoke(true) }
    fun collapse() { row?.setExpanded?.invoke(false) }
}
internal val LocalAWCListControllers=staticCompositionLocalOf { emptyMap<String,AWCListController>() }
internal val LocalAWCListItemControllers=staticCompositionLocalOf { emptyMap<String,AWCListItemController>() }
@Composable fun AWCListControllerScope(controller:AWCListController,id:String,content:@Composable ()->Unit) {
    val inherited=LocalAWCListControllers.current
    CompositionLocalProvider(LocalAWCListControllers provides inherited+(id to controller),content=content)
}
@Composable fun AWCListItemControllerScope(controller:AWCListItemController,id:String,content:@Composable ()->Unit) {
    val inherited=LocalAWCListItemControllers.current
    CompositionLocalProvider(LocalAWCListItemControllers provides inherited+(id to controller),content=content)
}
