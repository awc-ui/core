package dev.awc.nativeui

import dev.awc.nativeui.generated.AWCGeneratedTokens
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** md-list-item.css cascade rules resolved by NativeListItemStyle (values measured in Chrome, web-oracle paint/states). */
class NativeListStyleTest {
    private val tokens=AWCGeneratedTokens.light
    private fun style(p:Map<String,Any?> = emptyMap(),ctx:NativeListItemContext?=NativeListItemContext(hostList=true),inline:AWCListItemAppearance=AWCListItemAppearance(),
                      inherited:AWCListItemAppearance=AWCListItemAppearance(),density:Double=0.0,rung:Double=0.0,selected:Boolean=p["selected"]==true,expanded:Boolean=p["expanded"]==true,morph:Boolean=true)=
        NativeListItemStyle(NativeListItemModel(p),ctx,inline,inherited,tokens,false,density,rung,selected,expanded,false,false,false,morph)
    private val rest=NativeListItemStates()
    @Test fun restingCornersFollowListPosition() {
        assertEquals(listOf(16.0,16.0,0.0,0.0),style(ctx=NativeListItemContext(hostList=true,first=true)).corners(rest))
        assertEquals(listOf(0.0,0.0,16.0,16.0),style(ctx=NativeListItemContext(hostList=true,last=true)).corners(rest))
        assertEquals(listOf(4.0,4.0,4.0,4.0),style(ctx=NativeListItemContext(listStyle="segmented",hostList=true)).corners(rest))
        assertEquals(listOf(0.0,0.0,0.0,0.0),style(ctx=NativeListItemContext(hostList=true,inPanel=true)).corners(rest))
        assertEquals(listOf(0.0,0.0,16.0,16.0),style(ctx=NativeListItemContext(hostList=true,inPanel=true,lastInLastExpanded=true)).corners(rest))
        // Expanded rows square their end corners, but the list's outer ::slotted position rules win over that :host rule;
        // inline hooks beat the list's rules, inherited ones do not.
        assertEquals(listOf(0.0,0.0,0.0,0.0),style(mapOf("expandable" to true,"expanded" to true)).corners(rest))
        assertEquals(listOf(16.0,16.0,0.0,0.0),style(mapOf("expandable" to true,"expanded" to true),ctx=NativeListItemContext(hostList=true,first=true)).corners(rest))
        assertEquals(listOf(4.0,4.0,0.0,0.0),style(mapOf("expandable" to true,"expanded" to true),ctx=NativeListItemContext(listStyle="segmented",hostList=true)).corners(rest))
        assertEquals(listOf(5.0,16.0,0.0,0.0),style(ctx=NativeListItemContext(hostList=true,first=true),inline=AWCListItemAppearance(containerShapeStartStart=5.0)).corners(rest))
        assertEquals(listOf(16.0,16.0,0.0,0.0),style(ctx=NativeListItemContext(hostList=true,first=true),inherited=AWCListItemAppearance(containerShapeStartStart=5.0)).corners(rest))
    }
    @Test fun stateShapesMorphAndShapeMorphOff() {
        val s=style(mapOf("type" to "button"))
        assertEquals(List(4) { 16.0 },s.corners(rest.copy(active=true)))
        assertEquals(List(4) { 16.0 },s.corners(rest.copy(roving=true)))
        assertEquals(List(4) { 0.0 },s.corners(rest.copy(hover=true)))
        assertEquals(List(4) { 16.0 },style(mapOf("selected" to true)).corners(rest))
        assertEquals(List(4) { 0.0 },style(mapOf("type" to "button"),morph=false).corners(rest.copy(active=true)))
        assertEquals(List(4) { 16.0 },style(mapOf("type" to "button"),morph=false).corners(rest.copy(dragged=true)))
        assertEquals(List(4) { 20.0 },style(mapOf("type" to "button"),inherited=AWCListItemAppearance(activeContainerShape=20.0)).corners(rest.copy(pressed=true)))
    }
    @Test fun stateLayerPriorities() {
        val s=style(mapOf("type" to "button"))
        assertEquals(.08,s.layerOpacity(rest.copy(hover=true)),1e-9)
        assertEquals(.1,s.layerOpacity(rest.copy(hover=true,active=true)),1e-9)
        assertEquals(.1,s.layerOpacity(rest.copy(hover=true,roving=true)),1e-9)
        assertEquals(.08,s.layerOpacity(rest.copy(hover=true,focusVisible=true)),1e-9)
        assertEquals(.16,s.layerOpacity(rest.copy(dragged=true)),1e-9)
        assertEquals(0.0,style().layerOpacity(rest.copy(hover=true)),1e-9) // text row in none mode is not interactive
        assertFalse(style(mapOf("type" to "button","softDisabled" to true)).layerVisible)
        assertFalse(style(mapOf("type" to "button","disabled" to true)).interactive)
    }
    @Test fun colorsAndRoles() {
        val sel=style(mapOf("selected" to true),ctx=NativeListItemContext(hostList=true,selectionMode="multi-select"))
        assertEquals("#E8DEF8",sel.containerColor);assertEquals(tokens["--md-sys-color-on-secondary-container"],sel.labelColor)
        assertEquals("#1C1B1F61",style(mapOf("disabled" to true)).labelColor)
        assertEquals("#1C1B1F1F",style(mapOf("selected" to true,"disabled" to true),ctx=NativeListItemContext(hostList=true,selectionMode="single-select")).containerColor)
        assertTrue(style(mapOf("type" to "button")).hasPrimaryAction)
        assertFalse(style(mapOf("type" to "button"),ctx=NativeListItemContext(hostList=true,selectionMode="single-select")).hasPrimaryAction)
        assertTrue(style(ctx=NativeListItemContext(hostList=true,selectionMode="single-select")).focusable)
        assertFalse(style(mapOf("expandable" to true)).focusable)
        assertTrue(style(ctx=NativeListItemContext(hostList=true,reorderable=true)).focusable)
    }
    @Test fun densityMetrics() {
        assertEquals(56.0,style().minHeight,0.0);assertEquals(72.0,style(mapOf("supportingText" to "s")).minHeight,0.0);assertEquals(88.0,style(mapOf("lines" to 3)).minHeight,0.0)
        val d=style(density=-4.0,rung=-4.0)
        assertEquals(40.0,d.minHeight,0.0);assertEquals(8.0,d.padding.start,0.0);assertEquals(2.0,d.padding.top,0.0);assertEquals(8.0,d.gap,0.0)
        assertEquals(14.0,d.headlineSize,0.0);assertEquals(20.0,d.headlineLine,0.0)
        assertEquals(12.0,style(density=-2.0,rung=-2.0).padding.start,0.0)
        assertEquals(16.0,style(mapOf("leadingImage" to "x"),density=-4.0,rung=-4.0).padding.start,0.0)
        assertEquals(12.0,style(mapOf("lines" to 3)).padding.top,0.0)
        assertEquals(20.0,style().leadingIconSize,0.0);assertEquals(24.0,style(ctx=null).leadingIconSize,0.0)
        assertEquals(3,style(mapOf("overline" to "o","supportingText" to "s")).lines)
    }
}
