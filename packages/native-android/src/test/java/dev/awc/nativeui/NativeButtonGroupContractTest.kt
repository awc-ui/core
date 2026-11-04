package dev.awc.nativeui

import org.junit.Assert.*
import org.junit.Test

class NativeButtonGroupContractTest {
    @Test fun gapsMatchAllSizeDensityRungsAndConnectedSeam() {
        for((size,expected) in mapOf("xs" to listOf(18f,16f,14f,12f,10f),"sm" to listOf(12f,10.5f,9f,7.5f,6f),"md" to listOf(8f,7f,6f,5f,4f),"lg" to listOf(8f,7f,6f,5f,4f),"xl" to listOf(8f,7f,6f,5f,4f))) {
            assertEquals(expected,(0 downTo -4).map { buttonGroupGap(size,it.toFloat(),false) })
            assertTrue((0 downTo -4).all { buttonGroupGap(size,it.toFloat(),true)==2f })
        }
    }
    @Test fun groupCornersOverrideBothChildTypesAndRetainLogicalEdges() {
        assertEquals(24f to 8f,buttonGroupCorners("md",false,false,false,true,false,false))
        assertEquals(28f to 8f,buttonGroupCorners("md",false,true,false,true,false,false))
        assertEquals(8f to 8f,buttonGroupCorners("md",true,true,false,true,false,false))
        assertEquals(24f to 24f,buttonGroupCorners("md",false,true,true,true,true,false))
        assertEquals(4f to 4f,buttonGroupCorners("md",true,false,true,true,true,true))
    }
    @Test fun flexSharesContentBoxesAndFreezesOnlyExplicitFloors() {
        val widths=buttonGroupFlexWidths(576f,listOf(58f,0f,58f),listOf(32f,0f,32f))
        assertEquals(202.6667f,widths[0],.001f);assertEquals(170.6667f,widths[1],.001f)
        val narrow=buttonGroupFlexWidths(176f,listOf(58f,0f,58f),listOf(32f,0f,32f))
        assertEquals(69.3333f,narrow[0],.001f);assertEquals(37.3333f,narrow[1],.001f)
        assertEquals(listOf(48f,48f,48f),buttonGroupFlexWidths(76f,listOf(48f,48f,48f),listOf(24f,0f,24f)))
    }
    @Test fun appearanceValidationAndInheritanceAreFieldWise() {
        val inherited=AWCButtonGroupAppearance(gap=8.0,width=200.0,minHeight=40.0)
        val merged=inherited.merged(AWCButtonGroupAppearance(gap=Double.NaN,width=-1.0,height=64.0))
        assertEquals(8.0,merged.gap!!,0.0);assertEquals(200.0,merged.width!!,0.0);assertEquals(64.0,merged.height!!,0.0)
        assertNull(AWCButtonGroupAppearance.fromValues(mapOf("maxWidth" to 2401,"minWidth" to "80")).maxWidth)
        assertEquals(0.0,AWCButtonGroupAppearance.fromValues(mapOf("width" to 0)).width!!,0.0)
    }
    @Test fun rawClickUsesPreviousEventSnapshotAndPreservesDuplicateValues() {
        val events=mutableListOf<AWCValue>();val scope=SelectionScope("md-button-group",mapOf("selectionMode" to "multi-select"),emit={_,v->events+=v})
        scope.register("a","",true);scope.register("b","",true);scope.register("c","next",false);scope.seedPreviousValues()
        scope.states["a"]=false;scope.states["b"]=false;scope.states["c"]=true
        scope.reconcileButtonClick("c")
        assertEquals(mapOf("values" to listOf("next"),"added" to listOf("next"),"removed" to listOf("","")),events.single())
        scope.reconcileButtonClick("c")
        assertEquals(mapOf("values" to listOf("next"),"added" to emptyList<String>(),"removed" to emptyList<String>()),events.last())
    }
    @Test fun requiredReconcilesEvenWithoutAChildToggleAndReorderKeepsActualStates() {
        val scope=SelectionScope("md-button-group",mapOf("required" to true),emit={_,_->})
        scope.register("a","a",true);scope.register("b","b",false);scope.seedPreviousValues()
        scope.reconcileButtonClick("b")
        assertEquals(listOf("b"),scope.selectedValues())
        scope.reorder(listOf("b","a"));assertEquals(listOf("b","a"),scope.indices)
        assertEquals(listOf(true,false),scope.indices.map { scope.states[it]==true })
    }
    @Test fun ancestorMembershipSharesSelectionButReconciliationUsesEachGroupsDescendants() {
        val events=mutableListOf<String>()
        val outer=SelectionScope("md-button-group",emptyMap(),emit={_,v->events+="outer:${(v as Map<*,*>)["values"]}"})
        val inner=SelectionScope("md-button-group",emptyMap(),parentButtonGroup=outer,emit={_,v->events+="inner:${(v as Map<*,*>)["values"]}"})
        outer.register("a","A",true);outer.register("b","B",true);outer.register("c","C",false)
        inner.register("b","B",true);inner.register("c","C",false)
        outer.seedPreviousValues();inner.seedPreviousValues();inner.states["c"]=true
        inner.reconcileButtonClick("c");assertTrue(outer.states["a"]==true)
        outer.reconcileButtonClick("c")
        assertEquals(listOf("inner:[C]","outer:[C]"),events)
        assertEquals(listOf("C"),inner.selectedValues());assertEquals(listOf("C"),outer.selectedValues())
        inner.remove("c");assertTrue(outer.states["c"]==true)
        outer.remove("c");assertFalse("c" in outer.states)
    }
    @Test fun observerUnbindOnlyClearsItsCurrentOwnerAndLatestPropertySyncWins() {
        val state=AWCButtonGroupState();val first=Any();val second=Any()
        state.bind(first) { listOf(true) };assertEquals(listOf(true),state.snapshot())
        state.bind(second) { listOf(false) };state.unbind(first);assertEquals(listOf(false),state.snapshot())
        state.unbind(second);assertTrue(state.snapshot().isEmpty())
        val outer=SelectionScope("md-button-group",mapOf("size" to "lg"),emit={_,_->})
        val inner=SelectionScope("md-button-group",mapOf("size" to "xs"),parentButtonGroup=outer,emit={_,_->})
        assertTrue(outer.syncRevision>inner.syncRevision)
        inner.updateProps(mapOf("size" to "md"));assertTrue(inner.syncRevision>outer.syncRevision)
        outer.updateProps(mapOf("size" to "sm"));assertTrue(outer.syncRevision>inner.syncRevision)
    }

}
