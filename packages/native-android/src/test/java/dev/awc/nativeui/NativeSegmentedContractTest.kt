package dev.awc.nativeui

import org.junit.Assert.*
import org.junit.Test

class NativeSegmentedContractTest {
    @Test fun appearanceValidatesAndCascadesAllSevenHooksIncludingZero() {
        val base=AWCSegmentedButtonAppearance("#aabbcc","#112233","#abcdef","#fedcba","#aa00aa",0.0,2400.0).normalized()
        assertEquals(7,base.values.size);assertEquals("#AABBCC",base.containerColor)
        assertEquals(base,base.merged(AWCSegmentedButtonAppearance(containerColor="red",iconSize=Double.NaN,cornerRadius=-1.0)))
        assertEquals(0.0,base.merged(AWCSegmentedButtonAppearance(iconSize=0.0)).iconSize!!,0.0)
    }
    @Test fun nowrapVisualTextCollapsesAsciiWhitespaceWithoutDiscardingNbsp() {
        assertEquals("A B",awcCollapsedWhitespace("  A\n\tB "));assertEquals("",awcCollapsedWhitespace(" \n"))
        assertEquals("A\u00a0 B",awcCollapsedWhitespace("A\u00a0 B"))
    }
    @Test fun scopedChangeRetainsExactArrayShapeAndTypedValues() {
        val values=listOf("same","same","")
        val event=AWCActionEvent("mdChange","md-segmented-button-set",mapOf("values" to values),rawDetail=values)
        assertSame(values,event.rawDetail);assertEquals(values,event.segmentedSelectionValues)
        assertNull(AWCActionEvent("mdChange","md-button",mapOf("selected" to true)).segmentedSelectionValues)
    }
    @Test fun parentDensityClassesAndLocalInsetTokenFollowTheSourceCascade() {
        for(rung in 0 downTo -4) {
            val m=SegmentedMetrics.from(mapOf("density" to rung))
            assertEquals(40f+4*rung,m.height,0f);assertEquals(18f+rung,m.icon,0f)
            assertEquals(8f+rung,m.gap,0f);assertEquals(14f+.5f*rung,m.font,0f)
            assertEquals(20f+rung,m.line,0f);assertEquals(if(rung<=-2) 8f else 12f,m.inset,0f)
        }
        assertEquals(SegmentedMetrics(-1,8f),SegmentedMetrics.from(mapOf("density" to -1,"segmentDensity" to -4),-4,8f))
        assertEquals(SegmentedMetrics(-3,12f),SegmentedMetrics.from(mapOf("segmentDensity" to 3)))
        assertEquals(SegmentedMetrics(-2,12f),SegmentedMetrics.from(mapOf("density" to 0),-2))
    }
    private fun entry(id:Any,value:String="",disabled:Boolean=false,activate:(AWCActivationMetadata)->Unit={}):SegmentEntry =
        SegmentEntry(id,id.toString(),value,disabled,AWCButtonFocusState().apply { attached=true;enabled=!disabled },activate)
    @Test fun identityCommitPreservesInitialInvalidSelectionAndDuplicateEmptyValues() {
        val a=Any();val b=Any();val c=Any();val scope=SegmentedSetScope(emptyMap(),null)
        listOf(entry(a,"same"),entry(b,"same"),entry(c)).forEach { scope.register(it,true) }
        assertEquals(listOf(true,true,true),scope.entries.map { scope.selected[it.id] })
        val events=mutableListOf<List<String>>();scope.emitChange={values,_->events+=values}
        scope.accept(b.toString(),false,AWCActivationMetadata())
        assertEquals(listOf(false,true,false),scope.entries.map { scope.selected[it.id] });assertEquals(listOf("same"),events.last())
        scope.accept(b.toString(),true,AWCActivationMetadata());assertEquals(2,events.size)
        scope.update(mapOf("multiselect" to true));scope.accept(a.toString(),true,AWCActivationMetadata())
        assertEquals(listOf("same","same"),events.last())
        scope.reorder(listOf(c,b,a));scope.accept(c.toString(),true,AWCActivationMetadata())
        assertEquals(listOf("","same","same"),events.last())
    }
    @Test fun arrowsWrapInAuthoredOrderSkipOnlyHardDisabledAndCanOnlyFocus() {
        val scope=SegmentedSetScope(emptyMap(),null);val a=Any();val b=Any();val c=Any();val activated=mutableListOf<Any>()
        val first=entry(a,activate={activated+=a});val disabled=entry(b,disabled=true);val soft=entry(c,activate={activated+=c})
        listOf(first,disabled,soft).forEach { scope.register(it,false) }
        assertTrue(scope.move(a,true,true));assertEquals(listOf(c),activated);assertTrue(soft.focus.pending)
        scope.move(c,true,false);assertEquals(listOf(c),activated);assertTrue(first.focus.pending)
        scope.reorder(listOf(c,b,a));scope.move(a,false,true);assertEquals(listOf(c,c),activated)
    }
    @Test fun nestedMembershipSharesStateAndPublicSnapshotsDetachByIdentity() {
        val outer=SegmentedSetScope(mapOf("density" to -4),null);val inner=SegmentedSetScope(emptyMap(),outer)
        val id=Any();val child=entry(id,"child");outer.register(child,false);inner.register(child,false)
        assertSame(outer.selected,inner.selected);assertTrue(outer.revision>inner.revision)
        inner.update(mapOf("density" to -1));assertTrue(inner.revision>outer.revision)
        inner.accept(child.targetID,true,AWCActivationMetadata());assertTrue(outer.selected[id]==true)
        val state=AWCSegmentedButtonSetState();state.bind(inner) { inner.entries.map { inner.selected[it.id]==true } }
        val before=state.snapshot();assertSame(before,state.snapshot())
        state.unbind(outer);assertEquals(listOf(true),state.snapshot())
        inner.remove(id);assertTrue(outer.selected[id]==true);outer.remove(id);assertNull(outer.selected[id])
        state.unbind(inner);assertEquals(emptyList<Boolean>(),state.snapshot())
    }
    @Test fun narrowGridTracksFreezeAtPaddingFloorsAndKeepSingleEndCssRadius() {
        assertEquals(listOf(24,24,23),segmentedTrackWidths(60,listOf(24,24,23)))
        assertEquals(listOf(24,24,23),segmentedTrackWidths(0,listOf(24,24,23)))
        assertEquals(listOf(20,20,20),segmentedTrackWidths(60,listOf(16,16,15)))
        assertEquals(listOf(30,50,30),segmentedTrackWidths(110,listOf(24,50,23)))
        assertEquals(20f,segmentedUsedRadius(24f,40f,true,false,9999f),.001f)
        assertEquals(12f,segmentedUsedRadius(24f,40f,true,true,9999f),.001f)
    }
}
