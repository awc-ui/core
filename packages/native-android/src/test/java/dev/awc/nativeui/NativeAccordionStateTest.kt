package dev.awc.nativeui

import org.junit.Assert.*
import org.junit.Test

class NativeAccordionStateTest {
    private fun item(id:String,open:Boolean=false,disabled:Boolean=false)=NativeAccordionItemState(id,open,disabled)
    @Test fun defaultsUseSourceNumberGrammarWithoutTreatingBlanksAsZero() {
        assertTrue(NativeAccordionState.defaultIndices(" , , ").isEmpty())
        assertEquals(setOf(0,1,2,3,4,5,6),NativeAccordionState.defaultIndices("1, 2e0,0x3,0b100,0o5,+6,-0,NaN,Infinity,-2,2.5,7px"))
        assertTrue(NativeAccordionState.defaultIndices("0x1p2,+0x3,1_000,1f").isEmpty())
        assertEquals(setOf(3),NativeAccordionState.defaultIndices("0x+3,0o+4,0b+1,\u00852,\uFEFF3\uFEFF"))
    }
    @Test fun initialExclusiveChoosesFirstIndexIncludingAuthoredDisabledItems() {
        val a=item("a",disabled=true);val b=item("b",open=true);val c=item("c")
        val g=NativeAccordionState(NativeAccordionConfiguration(exclusive=true,defaultExpanded="2,0"));g.connect(listOf(a,b,c))
        assertEquals(listOf(0),g.expandedIndices)
        b.toggle();assertEquals(listOf(1),g.expandedIndices)
        g.update(g.configuration.copy(defaultExpanded="2"));assertEquals(listOf(1),g.expandedIndices)
        g.update(g.configuration.copy(exclusive=false));c.toggle();assertEquals(listOf(1,2),g.expandedIndices)
        g.update(g.configuration.copy(exclusive=true));assertEquals(listOf(1),g.expandedIndices)
    }
    @Test fun keepOneLocksActivationButAllowsDirectPropertyUpdates() {
        val a=item("a",disabled=true);val b=item("b");val c=item("c")
        val g=NativeAccordionState(NativeAccordionConfiguration(exclusive=true,keepOneExpanded=true));g.connect(listOf(a,b,c))
        assertEquals(listOf(1),g.expandedIndices);assertFalse(b.collapsible);assertFalse(b.disabled)
        b.toggle();assertTrue(b.expanded)
        c.toggle();assertEquals(listOf(2),g.expandedIndices);assertFalse(c.collapsible);assertTrue(b.collapsible)
        c.assignExpanded(false);assertTrue(g.expandedIndices.isEmpty());assertTrue(c.collapsible)
        g.synchronize(listOf(a,b,c));assertEquals(listOf(1),g.expandedIndices)
        g.synchronize(listOf(c));assertTrue(c.expanded);assertFalse(c.collapsible);assertEquals(0,c.index)
        g.update(g.configuration.copy(keepOneExpanded=false));c.toggle();assertFalse(c.expanded);assertTrue(c.collapsible)
    }
    @Test fun allDisabledAndStandaloneNoncollapsibleCasesRemainDistinct() {
        val g=NativeAccordionState(NativeAccordionConfiguration(keepOneExpanded=true));g.connect(listOf(item("a",disabled=true),item("b",disabled=true)))
        assertTrue(g.expandedIndices.isEmpty())
        val a=NativeAccordionItemState("standalone",collapsible=false)
        a.toggle();assertTrue(a.expanded);a.toggle();assertTrue(a.expanded)
        a.disabled=true;a.assignExpanded(false);a.toggle();assertFalse(a.expanded)
    }
    @Test fun transferPreservesOriginalAuthorshipAndIgnoresStaleOwnerRemoval() {
        val a=NativeAccordionItemState("authored",expanded=true,headingLevel=2,regionRole="none",collapsible=false)
        val first=NativeAccordionState(NativeAccordionConfiguration(keepOneExpanded=true,headingLevel=4,region="never"));first.connect(listOf(a))
        assertEquals(4,a.headingLevel);assertEquals("group",a.regionRole);assertFalse(a.collapsible)
        val second=NativeAccordionState(NativeAccordionConfiguration(headingLevel=6));second.connect(listOf(a));first.synchronize(emptyList());first.disconnect()
        assertSame(second,a.owner);assertEquals(6,a.headingLevel);assertEquals("region",a.regionRole);assertTrue(a.collapsible);assertEquals(0,a.index)
        second.synchronize(emptyList())
        assertNull(a.owner);assertEquals(2,a.headingLevel);assertEquals("none",a.regionRole);assertFalse(a.collapsible);assertEquals(-1,a.index)
    }
    @Test fun dynamicMembershipAndRegionPolicyUpdateOnlyDirectItems() {
        val a=item("a");val b=item("b");val g=NativeAccordionState(NativeAccordionConfiguration(regionThreshold=1.0));g.connect(listOf(a,b))
        assertEquals("group",a.regionRole);assertEquals("group",b.regionRole)
        g.synchronize(listOf(b));assertEquals("region",b.regionRole)
        g.update(g.configuration.copy(region="always",regionThreshold=0.0));assertEquals("region",b.regionRole)
        g.update(g.configuration.copy(region="never"));assertEquals("group",b.regionRole)
        g.disconnect();g.connect(listOf(b));assertEquals("group",b.regionRole);assertEquals(0,b.index)
    }
    @Test fun nestedSelectionDoesNotReachOuterCoordination() {
        val outer=NativeAccordionState(NativeAccordionConfiguration(exclusive=true));val inner=NativeAccordionState(NativeAccordionConfiguration(exclusive=true))
        outer.connect(listOf(item("outer-a"),item("outer-b",open=true)));val a=item("inner-a");inner.connect(listOf(a))
        var events=0;outer.emit={_,_->events++};a.toggle()
        assertEquals(listOf(1),outer.expandedIndices);assertTrue(a.expanded);assertEquals(0,events)
    }
    @Test fun navigationMatchesActualBrowserDisabledNavigationTrace() {
        val rows=listOf(item("a",disabled=true),item("b"),item("c",disabled=true),item("d"));val g=NativeAccordionState();g.connect(rows)
        val focused=mutableListOf<Int>();rows.forEachIndexed { i,row->row.requestFocus={focused+=i} }
        rows[1].key("ArrowDown");rows[3].key("ArrowDown");rows[1].key("ArrowUp");rows[3].key("Home");rows[1].key("End")
        assertEquals(listOf(3,1,3,1,3),focused)
        assertFalse(rows[0].key("ArrowDown"));assertFalse(rows[1].key("Escape"))
        rows[1].key("Enter");rows[1].key(" ");assertFalse(rows[1].expanded)
    }
    @Test fun keyboardReorderPreservesIdentityRefocusesAndTransfersGrip() {
        val rows=listOf(item("a",disabled=true),item("b"),item("c",disabled=true),item("d"))
        val g=NativeAccordionState(NativeAccordionConfiguration(reorderable=true,floating=true));g.connect(rows)
        var focused=-1;rows.forEachIndexed { i,row->row.requestFocus={focused=i} }
        val events=mutableListOf<AWCValue>();g.emit={n,d->if(n=="mdReorder") events+=d}
        rows[1].key("ArrowUp",true)
        assertEquals(listOf(1,0,2,3),g.originalIndices);assertEquals(0,rows[1].index);assertTrue(rows[1].hasChassisHandle);assertFalse(rows[0].hasChassisHandle);assertEquals(1,focused)
        rows[1].key("ArrowUp",true);assertEquals(1,events.size)
        rows[1].key("ArrowDown",true);rows[1].key("ArrowDown",true)
        assertEquals(listOf(0,2,1,3),g.originalIndices);assertEquals(listOf(0,2,1,3),(events.last() as Map<*,*>)["order"])
        g.synchronize(listOf(item("inserted"))+g.items);assertEquals(listOf(4,0,2,1,3),g.originalIndices)
        g.update(g.configuration.copy(reorderable=false));val before=g.originalIndices;rows[1].key("ArrowUp",true);assertEquals(before,g.originalIndices)
    }
    @Test fun standaloneItemStillDeclaresReorderRequest() {
        val a=item("solo");var detail:AWCValue=null;a.emit={n,d->if(n=="mdItemRequestReorder") detail=d;true}
        assertTrue(a.key("ArrowDown",true));assertEquals(mapOf("direction" to "down","from" to -1),detail)
    }
    private val rects=listOf(AccordionItemRect(100.0,60.0),AccordionItemRect(168.0,100.0),AccordionItemRect(276.0,60.0))
    @Test fun pointerReorderUsesSnapshotCentersAndRejectsUnrelatedPointers() {
        val rows=listOf(item("a"),item("b"),item("c"));val g=NativeAccordionState(NativeAccordionConfiguration(reorderable=true,floating=true));g.connect(rows)
        assertFalse(g.beginReorder(rows[0],1,button=2,clientY=110.0,hostTop=100.0,rects=rects))
        assertTrue(g.beginReorder(rows[0],1,clientY=110.0,hostTop=100.0,rects=rects));assertEquals(AccordionPlaceholder(0.0,60.0),g.dropPlaceholder)
        assertFalse(g.beginChassis(2,clientX=0.0,clientY=0.0))
        g.moveReorder(9,999.0);g.endReorder(9);assertEquals(0.0,g.draggedOffset,0.0);assertEquals("a",g.draggedItemID)
        g.moveReorder(1,198.0);assertEquals(0.0,g.dropPlaceholder!!.top,0.0)
        g.moveReorder(1,199.0);assertEquals(AccordionPlaceholder(68.0,60.0),g.dropPlaceholder);assertEquals(mapOf("b" to -68.0),g.siblingOffsets)
        g.moveReorder(1,400.0);assertEquals(AccordionPlaceholder(176.0,60.0),g.dropPlaceholder);assertEquals(mapOf("b" to -68.0,"c" to -68.0),g.siblingOffsets)
    }
    @Test fun cancelAbandonsOrderWhileDropCommitsAndClearsPlaceholder() {
        val rows=listOf(item("a"),item("b"),item("c"));val g=NativeAccordionState(NativeAccordionConfiguration(reorderable=true));g.connect(rows)
        val events=mutableListOf<String>();g.emit={n,_->events+=n}
        g.beginReorder(rows[0],1,clientY=110.0,hostTop=100.0,rects=rects);g.moveReorder(1,400.0);g.endReorder(1,cancelled=true)
        assertEquals(listOf(0,1,2),g.originalIndices);assertNull(g.dropPlaceholder);assertTrue(g.siblingOffsets.isEmpty());assertTrue(events.isEmpty())
        g.beginReorder(rows[2],2,clientY=280.0,hostTop=100.0,rects=rects);g.moveReorder(2,0.0);g.endReorder(2)
        assertEquals(listOf(2,0,1),g.originalIndices);assertEquals(listOf("mdReorder"),events);assertNull(g.dropPlaceholder)
        g.beginReorder(rows[2],3,clientY=100.0,hostTop=100.0,rects=rects);g.update(g.configuration.copy(reorderable=false));g.endReorder(3)
        assertNull(g.draggedItemID);assertEquals(1,events.size)
    }
    @Test fun membershipChangesCancelPendingReorder() {
        val rows=listOf(item("a"),item("b"),item("c"));val g=NativeAccordionState(NativeAccordionConfiguration(reorderable=true));g.connect(rows)
        var events=0;g.emit={_,_->events++}
        g.beginReorder(rows[0],1,clientY=100.0,hostTop=100.0,rects=rects);g.moveReorder(1,500.0);g.synchronize(rows.take(2));g.endReorder(1)
        assertEquals(listOf(0,1),g.originalIndices);assertNull(g.dropPlaceholder);assertEquals(0,events)
    }
    @Test fun floatingCoordinatesArePhysicalUnclampedAndSeedsAreNotBindings() {
        val g=NativeAccordionState(NativeAccordionConfiguration(floating=true,initialX=10.0,initialY=20.0));g.connect(listOf(item("a")))
        assertEquals(10.0,g.x,0.0);assertEquals(20.0,g.y,0.0);val z=g.zIndex!!
        g.update(g.configuration.copy(initialX=70.0,initialY=80.0));assertEquals(10.0,g.x,0.0);assertEquals(20.0,g.y,0.0)
        val events=mutableListOf<Pair<String,AWCValue>>();g.emit={n,d->events+=n to d}
        assertTrue(g.beginChassis(4,clientX=100.0,clientY=200.0));assertTrue(g.zIndex!!>z)
        g.moveChassis(99,0.0,0.0);assertEquals(10.0,g.x,0.0);assertEquals(20.0,g.y,0.0)
        g.moveChassis(4,-100.0,250.0);assertEquals(-190.0,g.x,0.0);assertEquals(70.0,g.y,0.0)
        g.endChassis(4,-90.0,260.0)
        assertFalse(g.chassisDragging);assertEquals(-190.0,g.x,0.0);assertEquals(70.0,g.y,0.0)
        assertEquals("mdDragEnd" to mapOf("clientX" to -90.0,"clientY" to 260.0,"x" to -190.0,"y" to 70.0,"dx" to -190.0,"dy" to 60.0),events.last())
        g.update(g.configuration.copy(floating=false));assertEquals(0.0,g.x,0.0);assertEquals(0.0,g.y,0.0);assertNull(g.zIndex);assertFalse(g.items[0].hasChassisHandle)
        g.update(g.configuration.copy(floating=true,bringToFront=false));assertEquals(70.0,g.x,0.0);assertEquals(80.0,g.y,0.0);assertNull(g.zIndex)
        g.beginChassis(5,clientX=0.0,clientY=0.0);val count=events.size;g.disconnect();g.moveChassis(5,10.0,10.0);g.endChassis(5,10.0,10.0)
        assertFalse(g.chassisDragging);assertNull(g.zIndex);assertEquals(count,events.size)
        assertFalse(g.beginChassis(6,clientX=0.0,clientY=0.0))
    }
    @Test fun exclusiveTogglePreservesNestedSynchronousEventOrderAndFinalDetail() {
        val a=item("a",open=true);val b=item("b");val g=NativeAccordionState(NativeAccordionConfiguration(exclusive=true));g.connect(listOf(a,b))
        val records=mutableListOf<Pair<String,AWCValue>>()
        a.emit={n,d->records+=n to d;true};b.emit={n,d->records+=n to d;true};g.emit={n,d->records+=n to d}
        b.toggle()
        assertEquals(listOf("mdItemToggle","mdItemToggle","mdToggle","mdToggle"),records.map { it.first })
        assertEquals(mapOf("index" to 1,"expanded" to true,"expandedIndices" to listOf(1)),records.last().second)
        records.clear();a.emit={n,d->records+=n to d;false};a.toggle()
        assertTrue(a.expanded);assertTrue(b.expanded);assertEquals(1,records.size)
        a.toggle();a.toggle();assertEquals(3,records.size)
    }
}
