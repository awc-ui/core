package dev.awc.nativeui

import org.junit.Assert.*
import org.junit.Test

class NativeTooltipContractTest {
    private class Clock:TooltipScheduler {
        data class Task(val due:Long,val action:()->Unit,var cancelled:Boolean=false)
        var now=0L;val tasks=mutableListOf<Task>()
        override fun schedule(delayMillis:Long,action:()->Unit):TooltipCancellation {
            val task=Task(now+delayMillis,action);tasks+=task;return TooltipCancellation { task.cancelled=true }
        }
        fun advance(delta:Long) {
            val end=now+delta
            while(true) {
                val next=tasks.filter { !it.cancelled && it.due<=end }.minByOrNull { it.due } ?: break
                tasks.remove(next);now=next.due;next.action()
            };now=end
        }
    }
    private class Fixture(open:Boolean=false,disabled:Boolean=false) {
        val clock=Clock();val state=NativeTooltipState();val events=mutableListOf<Pair<String,AWCValue>>()
        var restored=0
        init {
            state.emit={n,d->events+=n to d};state.restoreAnchorFocus={restored++}
            state.updateDisabled(disabled);state.sourceOpen(open);state.connect(clock)
        }
    }
    @Test fun firstOpenAndReconnectKeepBalancedInstanceEvents() {
        val f=Fixture(true)
        assertEquals(listOf("mdOpen" to null),f.events)
        f.state.disconnect();assertTrue(f.state.visible);f.state.connect(f.clock)
        assertEquals(1,f.events.size)
        f.state.hide();f.state.hide();assertEquals(listOf("mdOpen" to null,"mdClose" to null),f.events)
    }
    @Test fun detachedOpeningWaitsForConnectionAndCanBeCancelled() {
        val f=Fixture();f.state.disconnect();f.state.show()
        assertTrue(f.state.open);assertFalse(f.state.visible);assertTrue(f.events.isEmpty())
        f.state.hide();f.state.connect(f.clock);assertTrue(f.events.isEmpty())
        f.state.disconnect();f.state.show();f.state.connect(f.clock)
        assertEquals(listOf("mdOpen" to null),f.events)
    }
    @Test fun disabledInitialAndAuthoredUpdatesNormalizeWithoutUnexpectedReopen() {
        val f=Fixture(true,true)
        assertFalse(f.state.open);assertFalse(f.state.visible);assertTrue(f.events.isEmpty())
        f.state.show();f.state.sourceOpen(false);f.state.sourceOpen(true)
        assertFalse(f.state.open);f.state.updateDisabled(false);assertFalse(f.state.open)
        f.state.sourceOpen(true);assertFalse(f.state.open)
        f.state.sourceOpen(false);f.state.sourceOpen(true);assertTrue(f.state.visible)
        f.state.updateDisabled(true);assertEquals(listOf("mdOpen" to null,"mdClose" to null),f.events)
    }
    @Test fun hoverDelayGraceAndPopupEntryPermitPointerTravel() {
        val f=Fixture();f.state.triggerEnter();f.clock.advance(499);assertFalse(f.state.visible)
        f.clock.advance(1);assertTrue(f.state.visible)
        f.state.triggerLeave();f.clock.advance(199);f.state.popupEnter();f.clock.advance(500)
        assertTrue(f.state.visible)
        f.state.popupLeave();f.clock.advance(200);assertFalse(f.state.visible)
    }
    @Test fun publicIdempotentHideAndShowCancelOppositePendingTimers() {
        val f=Fixture();f.state.triggerEnter();f.state.hide();f.clock.advance(1000);assertFalse(f.state.visible)
        f.state.show();f.state.triggerLeave();f.state.show();f.clock.advance(1000);assertTrue(f.state.visible)
        assertEquals(listOf("mdOpen" to null),f.events)
    }
    @Test fun alreadyQueuedPointerCallbacksCannotReopenAfterDisableOrDisconnect() {
        val f=Fixture();f.state.triggerEnter();val stale=f.clock.tasks.last().action
        f.state.updateDisabled(true);stale();assertFalse(f.state.visible)
        f.state.updateDisabled(false);f.state.triggerEnter();val second=f.clock.tasks.last().action
        f.state.disconnect();second();assertFalse(f.state.open);assertTrue(f.events.isEmpty())
    }
    @Test fun escapeSuppressesImmediateReentryAndPreservesUnrelatedFocus() {
        val f=Fixture(true)
        assertTrue(f.state.escape());assertEquals(0,f.restored)
        f.state.triggerEnter();f.clock.advance(1000);assertFalse(f.state.visible)
        f.state.triggerLeave();f.state.triggerEnter();f.clock.advance(500);assertTrue(f.state.visible)
        f.state.popupFocused=true;assertTrue(f.state.escape());assertEquals(1,f.restored)
        f.state.triggerFocus();f.clock.advance(1000);assertFalse(f.state.visible)
        assertFalse(f.state.escape())
    }
    @Test fun focusMovingIntoActionsKeepsOpenAndLeavingUsesGraceDelay() {
        val f=Fixture();f.state.triggerFocus();f.clock.advance(500)
        f.state.triggerBlur(true);f.state.popupFocus();f.clock.advance(1000);assertTrue(f.state.visible)
        f.state.popupBlur(false);f.clock.advance(199);assertTrue(f.state.visible)
        f.clock.advance(1);assertFalse(f.state.visible)
    }
    @Test fun anchorRemovalCancelsRequestsAndDismissesVisibleTooltipOnce() {
        val f=Fixture();f.state.triggerEnter();f.state.removeAnchor();f.clock.advance(1000);assertTrue(f.events.isEmpty())
        f.state.show();f.state.removeAnchor();f.state.removeAnchor()
        assertEquals(listOf("mdOpen" to null,"mdClose" to null),f.events)
    }
    @Test fun controllerBeforeMountAndLivePropertyEdgesRemainIndependent() {
        val c=AWCTooltipController();c.show();c.state.sourceOpen(false)
        val clock=Clock();c.state.connect(clock);assertTrue(c.isOpen)
        c.state.sourceOpen(false);assertTrue(c.isOpen)
        c.state.sourceOpen(true);c.state.sourceOpen(false);assertFalse(c.isOpen)
        c.show();c.hide();assertFalse(c.isOpen)
    }
    @Test fun delayPolicyIsSampledWhenScheduledAndZeroOverflowTimersAreImmediate() {
        val f=Fixture();f.state.triggerEnter();f.state.showDelay=9000.0
        f.clock.advance(500);assertTrue(f.state.visible)
        f.state.hideDelay=Double.NaN;f.state.popupLeave();f.clock.advance(0);assertFalse(f.state.visible)
        f.state.showDelay=2147483648.0;f.state.triggerEnter();f.clock.advance(0);assertTrue(f.state.visible)
    }
    @Test fun physicalPlacementMirrorsOnlyInlineAxesAndOriginsFaceAnchor() {
        val anchor=TooltipBox(260.0,180.0,80.0,32.0)
        val top=nativeTooltipPlacement(anchor,126.859375,24.0,600.0,400.0,"top")
        assertEquals(236.5,top.left,.0001);assertEquals(148.0,top.top,.0001)
        val end=nativeTooltipPlacement(anchor,100.0,40.0,600.0,400.0,"top-start",true)
        assertEquals("top-end",end.side);assertEquals(240.0,end.left,.0001);assertEquals(1f,end.originY)
        val right=nativeTooltipPlacement(anchor,100.0,40.0,600.0,400.0,"left-start",true)
        assertEquals("right-start",right.side);assertEquals(348.0,right.left,.0001);assertEquals(180.0,right.top,.0001)
        assertEquals(0f,right.originX)
    }
    @Test fun autoPlacementFlipsMainAxisAndClampsOnlyCrossAxis() {
        val edge=TooltipBox(2.0,2.0,80.0,32.0)
        val automatic=nativeTooltipPlacement(edge,150.0,40.0,600.0,400.0)
        assertEquals("bottom",automatic.side);assertEquals(8.0,automatic.left,.0);assertEquals(42.0,automatic.top,.0)
        val exact=nativeTooltipPlacement(edge,150.0,40.0,600.0,400.0,autoPosition=false,crossOffset=-9.0)
        assertEquals("top",exact.side);assertEquals(-42.0,exact.left,.0);assertEquals(-46.0,exact.top,.0)
        val oversized=nativeTooltipPlacement(edge,800.0,600.0,600.0,400.0)
        assertEquals("top",oversized.side);assertEquals(8.0,oversized.left,.0)
    }
    @Test fun appearanceHasElevenHooksAndSignedSparsePartMetrics() {
        val a=AWCTooltipAppearance("#01020304","#112233","#445566","#778899","#abcdef","#AABBCC80",AWCCornerShape.uniform(4.0),
            AWCTooltipLength(fraction=.5,points=-8.0),AWCCornerShape.uniform(12.0),AWCTooltipLength(em=8.0),AWCTooltipLength(ch=32.0)).normalized()
        assertEquals(11,a.values.size);assertEquals("#ABCDEF",a.richTextColor)
        assertEquals(292.0,a.plainMaxWidth!!.resolve(600.0,16.0,16.0,8.0)!!,.0)
        val base=AWCTooltipPartAppearance(fontWeight=700,fontSize=18.0,paddingInlineStart=13.0)
        val merged=base.merged(AWCTooltipPartAppearance(marginInlineStart=-7.0,letterSpacing=-.5,paddingInlineStart=0.0,fontSize=Double.NaN))
        assertEquals(-7.0,merged.marginInlineStart!!,.0);assertEquals(-.5,merged.letterSpacing!!,.0)
        assertEquals(0.0,merged.paddingInlineStart!!,.0);assertEquals(18.0,merged.fontSize!!,.0)
    }
}
