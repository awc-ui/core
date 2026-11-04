package dev.awc.nativeui

import org.junit.Assert.*
import org.junit.Test

class NativeSnackbarLifecycleTest {
    private class Clock:SnackbarScheduler {
        data class Task(val due:Long,val action:()->Unit,var cancelled:Boolean=false)
        var now=0L
        val tasks=mutableListOf<Task>()
        override fun schedule(delayMillis:Long,action:()->Unit):SnackbarCancellation {
            val task=Task(now+delayMillis,action);tasks+=task
            return SnackbarCancellation { task.cancelled=true }
        }
        fun advance(time:Long) {
            val end=now+time
            while(true) {
                val next=tasks.filter { !it.cancelled && it.due<=end }.minByOrNull { it.due } ?: break
                tasks.remove(next);now=next.due;next.action()
            }
            now=end
        }
    }
    private class Fixture(open:Boolean=false,autoHide:Boolean=true,duration:Double=4000.0) {
        val clock=Clock();val state=NativeSnackbarState();val events=mutableListOf<Pair<String,AWCValue>>()
        var raises=0
        init {
            state.emit={name,detail->events+=name to detail};state.raise={raises++}
            state.autoHide=autoHide;state.autoHideDuration=duration;state.sourceOpen(open);state.connect(clock)
        }
    }
    @Test fun initialOpeningAndReconnectDoNotDuplicateOpenEvent() {
        val f=Fixture(true)
        assertEquals(listOf("mdOpen" to null),f.events)
        f.clock.advance(1000);f.state.disconnect();f.clock.advance(6000)
        assertTrue(f.state.open)
        f.state.connect(f.clock);assertEquals(2,f.raises);assertEquals(1,f.events.size)
        f.clock.advance(3999);assertTrue(f.state.open)
        f.clock.advance(1);assertFalse(f.state.open)
        assertEquals("mdClose" to mapOf("reason" to "auto"),f.events.last())
    }
    @Test fun detachedNewOpeningEmitsOnlyUponAttachAndCanBeCancelled() {
        val f=Fixture()
        f.state.disconnect();f.state.show();assertTrue(f.events.isEmpty())
        f.state.connect(f.clock);assertEquals(listOf("mdOpen" to null),f.events)
        f.state.hide();f.state.disconnect();f.state.show();f.state.sourceOpen(false)
        // The original source prop is already false: a repeated unchanged value
        // does not replace method-owned state. A real upstream edge does.
        f.state.sourceOpen(true);f.state.sourceOpen(false);f.state.connect(f.clock)
        assertFalse(f.state.open);assertEquals(2,f.events.size)
    }
    @Test fun directPropertyCloseHasNoCloseEventAndMethodsAreIdempotent() {
        val f=Fixture(true,false)
        f.state.show();f.state.sourceOpen(false);f.state.hide()
        assertEquals(listOf("mdOpen" to null),f.events)
        f.state.show();f.state.hide(AWCSnackbarCloseReason.Action);f.state.hide()
        assertEquals("mdClose" to mapOf("reason" to "action"),f.events.last())
        assertEquals(3,f.events.size)
    }
    @Test fun actionAlwaysRestartsTimerIncludingDisabledAutoHide() {
        val f=Fixture(true,false,500.0)
        f.clock.advance(5000);assertTrue(f.state.open)
        f.state.action();assertEquals("mdAction" to null,f.events.last())
        f.clock.advance(300);f.state.action();f.clock.advance(499);assertTrue(f.state.open)
        f.clock.advance(1);assertFalse(f.state.open)
        assertEquals("mdClose" to mapOf("reason" to "auto"),f.events.last())
    }
    @Test fun pauseAndResumeRestartFullLatestDurationWithoutReschedulingLiveTimer() {
        val f=Fixture(true,true,1000.0)
        f.clock.advance(500);f.state.autoHideDuration=2000.0
        f.clock.advance(499);assertTrue(f.state.open)
        f.state.pause();f.clock.advance(9000);assertTrue(f.state.open)
        f.state.pause();f.state.resume();f.clock.advance(1999);assertTrue(f.state.open)
        f.clock.advance(1);assertFalse(f.state.open)
        val unchanged=Fixture(true,true,1000.0)
        unchanged.clock.advance(500);unchanged.state.autoHideDuration=9000.0
        unchanged.clock.advance(500);assertFalse(unchanged.state.open)
    }
    @Test fun durationAndAutoHideEditsOnlyAffectTheNextSourceRestart() {
        val f=Fixture(true,true,300.0)
        f.state.autoHide=false;f.clock.advance(300);assertFalse(f.state.open)
        f.state.show();f.clock.advance(9000);assertTrue(f.state.open)
        f.state.autoHide=true;f.clock.advance(9000);assertTrue(f.state.open)
        f.state.action();f.clock.advance(300);assertFalse(f.state.open)
    }
    @Test fun escapeAndCloseCoalesceRippleAndDoNotCloseAFreshOpening() {
        val f=Fixture(true,false)
        assertFalse(f.state.escape());f.state.closeable=true
        assertTrue(f.state.escape());f.state.requestClose();f.clock.advance(149);assertTrue(f.state.open)
        f.clock.advance(1);assertFalse(f.state.open)
        assertEquals(2,f.events.size)
        f.state.show();f.state.requestClose();val stale=f.clock.tasks.last().action
        f.state.hide();f.state.show();stale();assertTrue(f.state.open)
        f.clock.advance(150);assertTrue(f.state.open)
    }
    @Test fun disconnectionCancelsAllTimersIncludingAlreadyQueuedCallbacks() {
        val f=Fixture(true,true,100.0)
        f.state.requestClose();val callbacks=f.clock.tasks.map { it.action }
        f.state.disconnect();callbacks.forEach { it() };f.clock.advance(9000)
        assertTrue(f.state.open);assertEquals(1,f.events.size)
        f.state.connect(f.clock);f.clock.advance(100)
        assertFalse(f.state.open);assertEquals(2,f.events.size)
    }
    @Test fun controllerCanShowBeforeMountAndKeepsStateAcrossReconnect() {
        val c=AWCSnackbarController();val clock=Clock();val events=mutableListOf<String>()
        c.state.emit={name,_->events+=name};c.show();c.state.sourceOpen(false)
        c.state.connect(clock);assertTrue(c.isOpen);assertEquals(listOf("mdOpen"),events)
        c.state.disconnect();c.state.connect(clock);assertEquals(listOf("mdOpen"),events)
        c.hide();assertFalse(c.isOpen);assertEquals(listOf("mdOpen","mdClose"),events)
    }
    @Test fun peerRanksStayBoundedAndNewestOpenPaintsLast() {
        val registry=NativeSnackbarRegistry();val a=NativeSnackbarState();val b=NativeSnackbarState();val c=NativeSnackbarState()
        listOf(a,b,c).forEach { s->
            registry.entries+=NativeSnackbarEntry(s,androidx.compose.runtime.mutableStateOf<@androidx.compose.runtime.Composable ()->Unit>({}))
            s.raise={registry.raise(s)};s.autoHide=false;s.connect(Clock())
        }
        a.show();b.show();c.show();assertEquals(listOf(1,2,3),listOf(a.rank,b.rank,c.rank))
        repeat(100) { a.hide();a.show() }
        assertEquals(listOf(3,1,2),listOf(a.rank,b.rank,c.rank))
        listOf(a,b,c).forEach { it.closeable=true }
        assertTrue(registry.escape())
    }
    @Test fun sevenAppearanceHooksPreserveAlphaAffineLengthsAndCornerCoefficients() {
        val inherited=AWCSnackbarAppearance(containerColor="#01020304",messageColor="#123456",minWidth=AWCSnackbarLength(fraction=.5,points=-48.0))
        val local=AWCSnackbarAppearance(containerColor="bad",actionColor="#ABCDEF80",closeColor="#998877",containerShape=AWCCornerShape.uniform(3.0,.2),maxWidth=AWCSnackbarLength(ch=20.0))
        val a=inherited.merged(local)
        assertEquals("#01020304",a.containerColor);assertEquals("#ABCDEF80",a.actionColor)
        assertEquals(7,a.values.size);assertEquals(132.0,a.minWidth!!.resolve(360.0,16.0,16.0,8.0)!!,.0001)
        assertEquals(AWCCornerShape.uniform(3.0,.2),a.containerShape)
    }
    @Test fun typedPartMergeKeepsSignedMarginsZeroAndValidInheritedFields() {
        val base=AWCSnackbarPartAppearance(color="#123456",backgroundColor="#abcdef80",borderWidth=3.0,paddingInlineStart=12.0,marginInlineStart=8.0,fontWeight=700)
        val zero=base.merged(AWCSnackbarPartAppearance(borderWidth=0.0,paddingInlineStart=0.0,marginInlineStart=-7.0))
        assertEquals(0.0,zero.borderWidth!!,.0);assertEquals(0.0,zero.paddingInlineStart!!,.0);assertEquals(-7.0,zero.marginInlineStart!!,.0)
        assertEquals("#ABCDEF80",zero.backgroundColor);assertEquals(700,zero.fontWeight)
        val invalid=base.merged(AWCSnackbarPartAppearance(color="bad",borderWidth=-1.0,paddingInlineStart=-3.0,marginInlineStart=Double.NaN,fontWeight=1001))
        assertEquals(base.copy(backgroundColor="#ABCDEF80"),invalid)
    }

}
