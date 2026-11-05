package dev.awc.playground

import dev.awc.nativeui.*
import org.junit.Assert.*
import org.junit.Test

class LivePreviewInspectionTest {
    @Test fun captureKeepsStableRootButDropsChangedPartsAndTheirDescendants() {
        val root=AWCInspectionNode("component","root",AWCInspectionBounds(0.0,0.0,48.0,48.0))
        val part=AWCInspectionNode("component.shape","shape",AWCInspectionBounds(5.0,5.0,38.0,38.0),"component")
        val child=part.copy(id="component.shape.child",parentId=part.id)
        val before=AWCInspectionSnapshot(listOf(root,part,child))
        assertEquals(before,stableLivePreviewInspection(before,before))
        assertEquals(listOf(root),stableLivePreviewInspection(before,AWCInspectionSnapshot(listOf(root,part.copy(),child))).nodes)
        assertTrue(stableLivePreviewInspection(before,AWCInspectionSnapshot(listOf(root.copy(),part,child))).nodes.isEmpty())
        assertTrue(stableLivePreviewInspection(before,AWCInspectionSnapshot(emptyList())).nodes.isEmpty())
    }
    @Test fun latePixelCopyAfterTimeoutCannotDrainEventsOrAdvanceSequence() {
        var active=true
        val ticket=LivePreviewCaptureTicket { active }
        val events=mutableListOf("mdComplete");var sequence=4;var discarded=0
        val delayedCallback={ ticket.deliver(expired={ discarded++ },current={ sequence++;events.clear() }) }
        assertTrue("Timeout owns completion and releases the held draw",ticket.finish())
        delayedCallback()
        assertEquals(listOf("mdComplete"),events);assertEquals(4,sequence);assertEquals(1,discarded)
        assertFalse("Late callback cannot finish a second time",ticket.finish())
        val next=LivePreviewCaptureTicket { active }
        next.deliver(expired={ fail("Next request remains independent") },current={ sequence++;events.clear() })
        assertEquals(5,sequence);assertTrue(events.isEmpty());assertTrue(next.finish())
        val superseded=LivePreviewCaptureTicket { active };active=false
        superseded.deliver(expired={ discarded++ },current={ fail("Replaced stream cannot consume pending events") })
        assertEquals(2,discarded)
    }

}
