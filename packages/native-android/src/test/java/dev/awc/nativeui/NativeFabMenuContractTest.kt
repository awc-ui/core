package dev.awc.nativeui

import kotlinx.coroutines.*
import org.junit.Assert.*
import org.junit.Test

class NativeFabMenuContractTest {
    @Test fun pendingShowIsCancelledAndOnlyLatestRequestCanOpen()=runBlocking {
        val events=mutableListOf<Boolean>()
        val state=NativeFabMenuState(false,this) { yield() }
        state.onOpenCommit={ events+=it }
        val cancelled=async(start=CoroutineStart.UNDISPATCHED) { state.show() }
        assertFalse(state.open)
        state.close()
        val latest=async(start=CoroutineStart.UNDISPATCHED) { state.show() }
        state.loaded()
        cancelled.await();latest.await()
        assertTrue(state.open);assertEquals(listOf(true),events)
        state.disconnect()
    }
    @Test fun closeReturnsBeforeCommitAndReopeningKeepsTheSameWhenClosedCycle()=runBlocking {
        val state=NativeFabMenuState(false,this) { yield() }
        val events=mutableListOf<Boolean>();state.onOpenCommit={ events+=it }
        state.loaded();state.show()
        val closed=async(start=CoroutineStart.UNDISPATCHED) { state.whenClosed() }
        state.close()
        assertTrue(state.open);assertTrue(state.closing);assertFalse(closed.isCompleted)
        state.show()
        delay(210)
        assertTrue(state.open);assertFalse(state.closing);assertFalse(closed.isCompleted)
        state.quick=true;state.close()
        assertFalse(state.open);closed.await()
        assertEquals(listOf(true,false),events)
        state.disconnect()
    }
    @Test fun initialOpenIsSilentAndDisconnectSettlesLifecycleWaits()=runBlocking {
        val state=NativeFabMenuState(true,this) { yield() }
        state.onOpenCommit={ fail("Initial open and disconnect do not emit lifecycle events") }
        state.loaded()
        assertTrue(state.open)
        val wait=async(start=CoroutineStart.UNDISPATCHED) { state.whenClosed() }
        assertFalse(wait.isCompleted);state.disconnect();wait.await()
        val loading=NativeFabMenuState(false,this) { yield() }
        val show=async(start=CoroutineStart.UNDISPATCHED) { loading.show() }
        loading.disconnect();show.await();assertFalse(loading.open)
    }
    @Test fun controllerOwnershipIsCheckedAndDetachedMethodsHaveClearSemantics()=runBlocking {
        val controller=AWCFabMenuController();val owner=Any()
        try { controller.show();fail("Detached show must fail") } catch(_:IllegalStateException) { }
        controller.close();controller.whenClosed()
        val state=NativeFabMenuState(false,this) { yield() };state.quick=true;state.loaded()
        controller.attach(owner,state);controller.show();assertTrue(controller.isOpen)
        try { controller.attach(Any(),state);fail("A controller cannot target two menus") } catch(_:IllegalStateException) { }
        controller.detach(Any());assertTrue(controller.isOpen)
        controller.close();controller.whenClosed();assertFalse(controller.isOpen)
        controller.detach(owner);state.disconnect()
    }
    @Test fun keyboardTraversalIncludesDisabledSourceItemsAndUsesAuthoredOrder()=runBlocking {
        val state=NativeFabMenuState(true,this) { yield() }
        val first=Any();val second=Any();val third=Any()
        val handles=listOf(first,second,third).associateWith { AWCButtonFocusState().apply { attached=true;enabled=true } }
        listOf(first to "New document",second to "New folder",third to "Upload image").forEach { (id,label)->
            state.register(NativeFabMenuItemEntry(id,handles.getValue(id)) { label })
        }
        state.loaded();state.effectivePlacement="down"
        state.focusItem(0);assertTrue(handles.getValue(first).pending)
        state.itemKey(first,"ArrowDown");assertEquals(1,state.focusedIndex)
        state.itemKey(second,"End");assertEquals(2,state.focusedIndex)
        state.itemKey(third,"n");assertEquals(0,state.focusedIndex)
        state.reorder(listOf(third,first,second))
        assertEquals(1,state.focusedIndex)
        state.itemKey(first,"Home");assertEquals(0,state.focusedIndex)
        state.disconnect()
    }
    @Test fun menuAndItemAppearanceKeepExactSourceHooksAndDensityGeometry() {
        val menu=AWCFabMenuAppearance("#aabbcc","#112233",0.0).normalized()
        assertEquals(3,menu.values.size);assertEquals("#AABBCC",menu.itemContainerColor)
        assertEquals(menu,menu.merged(AWCFabMenuAppearance("bad",null,Double.NaN)))
        val item=AWCFabMenuItemAppearance("#abcdef","#fedcba","#121212",0.0,2400.0).normalized()
        assertEquals(5,item.values.size)
        assertNull(AWCFabMenuItemAppearance(iconSize=-1.0).normalized().iconSize)
        for(d in 0 downTo -4) {
            val m=NativeFabMenuItemMetrics(d)
            assertEquals(48f+4*d,m.height,0f)
            assertEquals(20f+d,m.icon,0f)
            assertEquals(listOf(16f,16f,12f,12f,8f)[-d],m.leading,0f)
            assertEquals(listOf(24f,24f,20f,16f,16f)[-d],m.trailing,0f)
        }
    }
}
