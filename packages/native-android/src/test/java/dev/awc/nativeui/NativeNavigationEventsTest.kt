package dev.awc.nativeui

import org.junit.Assert.*
import org.junit.Test

class NativeNavigationEventsTest {
    @Test fun captureTargetBubbleSnapshotAndLegacyObservationPrecedeDefaults() {
        val calls = mutableListOf<String>()
        var captured: AWCActionEvent? = null
        val outer = AWCActionDispatcher(null, "outer", listeners = { listOf(AWCActionListener(AWCEventPhase.CAPTURE) { calls += "outer:capture" }) }) { calls += "outer:bubble" }
        val inner = AWCActionDispatcher(outer, "inner", listeners = { listOf(AWCActionListener(AWCEventPhase.CAPTURE) { calls += "inner:capture" }) }) { calls += "inner:bubble" }
        performNativeButtonAction(mapOf("href" to "next"), false, { _, _ -> calls += "legacy" }, inner, null, AWCURLRouter { calls += "navigate"; true },
            targetID = "button", targetListeners = listOf({ captured = it; calls += "target"; assertEquals(AWCEventPhase.TARGET, it.phase); assertEquals("button", it.currentScopeID) })) { it }
        assertEquals(listOf("outer:capture", "inner:capture", "target", "inner:bubble", "outer:bubble", "legacy", "navigate"), calls)
        assertEquals(listOf("button", "inner", "outer"), captured!!.path)
        assertEquals(AWCEventPhase.NONE, captured!!.phase); assertNull(captured!!.currentScopeID)
    }
    @Test fun captureCancellationPropagatesButBlocksToggleNavigationAndFormDefaults() {
        for (props in listOf(mapOf("href" to "next"), mapOf("type" to "submit"), mapOf("type" to "reset"))) {
            val calls = mutableListOf<String>()
            val action = AWCActionDispatcher(null, "scope", listeners = { listOf(AWCActionListener(AWCEventPhase.CAPTURE) { calls += "capture"; it.preventDefault() }) }) { calls += "bubble" }
            val form = AWCFormState(onSubmit = { fail("Canceled submit") }, onReset = { fail("Canceled reset") })
            assertFalse(performNativeButtonAction(props + mapOf("toggle" to true), false, { _, _ -> calls += "legacy" }, action, form,
                AWCURLRouter { fail("Canceled navigation"); false }, targetListeners = listOf({ calls += "target" })) { fail("Canceled toggle"); it })
            assertEquals(listOf("capture", "target", "bubble", "legacy"), calls)
        }
    }
    @Test fun stopPropagationKeepsSameScopeListenersAndImmediateStopsThem() {
        for (immediate in listOf(false, true)) {
            val calls = mutableListOf<String>()
            val outer = AWCActionDispatcher(null, "outer") { calls += "outer" }
            val inner = AWCActionDispatcher(outer, "inner", listeners = { listOf(
                AWCActionListener(AWCEventPhase.BUBBLE) { calls += "first"; if (immediate) it.stopImmediatePropagation() else it.stopPropagation() },
                AWCActionListener(AWCEventPhase.BUBBLE) { calls += "second" }) }) { calls += "third" }
            performNativeButtonAction(mapOf("href" to "next"), false, { _, _ -> calls += "legacy" }, inner, null, AWCURLRouter { calls += "navigate"; true }) { it }
            assertEquals(if (immediate) listOf("first", "legacy", "navigate") else listOf("first", "second", "third", "legacy", "navigate"), calls)
        }
    }
    @Test fun noncancelableChangeFollowsCommitAndNestedEventsKeepIndependentPaths() {
        var selected = false; var change: AWCActionEvent? = null; val calls = mutableListOf<String>()
        val innerEvent = AWCActionEvent("nested", "test", emptyMap(), targetID = "nested-target")
        val nested = AWCActionDispatcher(null, "nested-scope") { assertEquals("nested-target", it.targetID) }
        val action = AWCActionDispatcher(null, "outer") {
            if (it.name == "mdClick") {
                nested.dispatch(innerEvent)
                assertEquals(AWCEventPhase.BUBBLE, it.phase); assertEquals(listOf("button", "outer"), it.path)
            } else { assertTrue(selected); it.preventDefault(); change = it }
        }
        performNativeButtonAction(mapOf("toggle" to true), false, { name, _ -> calls += name }, action, null, AWCURLRouter { true }, targetID = "button") { selected = it; calls += "commit"; it }
        assertEquals(listOf("mdClick", "commit", "mdChange"), calls)
        assertFalse(change!!.cancelable); assertFalse(change!!.defaultPrevented)
        assertEquals(listOf("nested-target", "nested-scope"), innerEvent.path)
    }
    @Test fun boundariesAndNonBubblingEventsHaveExplicitNativeSemantics() {
        val calls = mutableListOf<String>()
        val outer = AWCActionDispatcher(null, "outer") { calls += "outer" }
        val boundary = AWCActionDispatcher(outer, "boundary", boundary = true, listeners = { listOf(AWCActionListener(AWCEventPhase.CAPTURE) { calls += "capture" }) }) { calls += "boundary" }
        val event = AWCActionEvent("local", "test", emptyMap(), bubbles = false, crossesBoundaries = false, targetID = "target")
        boundary.dispatch(event, listOf({ calls += "target" }))
        assertEquals(listOf("capture", "target"), calls); assertEquals(listOf("target", "boundary"), event.path)
    }
    @Test fun nativeTargetsResolveFromCurrentSourceAndMaintainIndependentHistories() {
        val presented = mutableListOf<AWCNavigationTransition>()
        val navigation = AWCNavigationCoordinator("https://awc.local/demo/", onPresent = { presented += it })
        val router = navigation.router("root")
        assertTrue(router.open(AWCNavigationRequest("pages/one", "_SELF")))
        assertEquals("https://awc.local/demo/pages/one", navigation.activeContext.currentURL)
        assertTrue(router.open(AWCNavigationRequest("two", "")))
        assertEquals("https://awc.local/demo/pages/two", navigation.activeContext.currentURL)
        val child = navigation.createContext("child", "root", "nested/")
        val grandchild = navigation.createContext("grandchild", child.id, "deep/")
        navigation.navigate(AWCNavigationRequest("parent", "_parent"), grandchild.id)
        assertEquals(child.id, navigation.activeContextID)
        navigation.navigate(AWCNavigationRequest("top", "_top"), grandchild.id)
        assertEquals("root", navigation.activeContextID)
        navigation.navigate(AWCNavigationRequest("report-one", "report"), "root")
        val named = navigation.activeContextID
        navigation.navigate(AWCNavigationRequest("report-two", "report"), "root")
        assertEquals(named, navigation.activeContextID); assertEquals(2, navigation.activeContext.history.size)
        navigation.navigate(AWCNavigationRequest("new", "_blank"), "root"); val blank = navigation.activeContextID
        navigation.navigate(AWCNavigationRequest("new", "_blank"), "root"); assertNotEquals(blank, navigation.activeContextID)
        assertEquals(8, presented.size)
    }
    @Test fun rejectionUnsafeLinksAndBackDoNotCorruptNativeHistory() {
        var reject = false; val presented = mutableListOf<AWCNavigationTransition>()
        val navigation = AWCNavigationCoordinator("https://awc.local/demo/", { !reject }, { presented += it })
        val router = navigation.router("root")
        router.open(AWCNavigationRequest("one", "_self")); router.open(AWCNavigationRequest("two", "_self"))
        assertTrue(navigation.back("root")); router.open(AWCNavigationRequest("three", "_self"))
        assertEquals(listOf("https://awc.local/demo/", "https://awc.local/demo/one", "https://awc.local/demo/three"), navigation.context("root")!!.history)
        reject = true
        val histories = navigation.contexts.map { it.history }; val count = presented.size
        assertFalse(router.open(AWCNavigationRequest("four", "_blank"))); assertFalse(navigation.back("root"))
        assertEquals(histories, navigation.contexts.map { it.history }); assertEquals(count, presented.size)
        reject = false
        for (url in listOf("javascript:alert(1)", "https://", "data:text/plain,no", "bad\nurl")) assertFalse(router.open(AWCNavigationRequest(url, "report")))
        assertEquals(1, navigation.contexts.size)
        assertTrue(router.open(AWCNavigationRequest("/parent", "_parent"))); assertEquals("root", navigation.activeContextID)
    }
    @Test fun closingNativeContextRemovesDescendantsAndNamesCanBeReused() {
        val navigation = AWCNavigationCoordinator("https://awc.local/demo/")
        val child = navigation.createContext("report")
        val descendant = navigation.createContext("nested", child.id)
        navigation.activate(descendant.id)
        assertTrue(navigation.close(child.id)); assertEquals("root", navigation.activeContextID)
        assertEquals(1, navigation.contexts.size); assertFalse(navigation.close("root"))
        assertTrue(navigation.navigate(AWCNavigationRequest("next", "report")))
        assertNotEquals(child.id, navigation.activeContextID)
    }
    @Test fun captureStopPreventsTargetAndTargetStopPreservesItsRemainingListeners() {
        val captureCalls = mutableListOf<String>()
        val capture = AWCActionDispatcher(null, "scope", listeners = { listOf(
            AWCActionListener(AWCEventPhase.CAPTURE) { captureCalls += "first"; it.stopPropagation() },
            AWCActionListener(AWCEventPhase.CAPTURE) { captureCalls += "second" }) }) { captureCalls += "bubble" }
        capture.dispatch(AWCActionEvent("mdClick", "md-button", emptyMap()), listOf({ captureCalls += "target" }))
        assertEquals(listOf("first", "second"), captureCalls)
        for (immediate in listOf(false, true)) {
            val calls = mutableListOf<String>()
            val scope = AWCActionDispatcher(null, "scope") { calls += "bubble" }
            scope.dispatch(AWCActionEvent("mdClick", "md-button", emptyMap()), listOf(
                { calls += "first"; if (immediate) it.stopImmediatePropagation() else it.stopPropagation() },
                { calls += "second" }))
            assertEquals(if (immediate) listOf("first") else listOf("first", "second"), calls)
        }
    }
    @Test fun approvalCannotMutateContextsOrReenterButPresentationCanNavigate() {
        lateinit var navigation: AWCNavigationCoordinator
        var approving = false
        navigation = AWCNavigationCoordinator("https://awc.local/demo/", shouldNavigate = { transition ->
            if (approving) {
                assertFalse(navigation.close(transition.contextID))
                assertFalse(navigation.activate("root"))
                assertFalse(navigation.navigate(AWCNavigationRequest("recursive", "_blank")))
                assertFalse(navigation.back())
                assertThrows(IllegalStateException::class.java) { navigation.createContext("recursive") }
            }
            true
        })
        val child = navigation.createContext("child")
        navigation.activate(child.id); approving = true
        assertTrue(navigation.navigate(AWCNavigationRequest("next", "_self")))
        assertEquals(child.id, navigation.activeContext.id)
        assertEquals("https://awc.local/demo/next", child.currentURL)
        lateinit var presentation: AWCNavigationCoordinator
        presentation = AWCNavigationCoordinator("https://awc.local/demo/", onPresent = {
            if (it.url.endsWith("/one")) presentation.navigate(AWCNavigationRequest("two", "_self"))
        })
        presentation.navigate(AWCNavigationRequest("one", "_self"))
        assertEquals("https://awc.local/demo/two", presentation.activeContext.currentURL)
    }
    @Test fun newNavigationDestinationsAreTopLevelAndUnknownReservedTargetsAreRejected() {
        val navigation = AWCNavigationCoordinator("https://awc.local/demo/")
        for (target in listOf("_blank", "report")) {
            navigation.navigate(AWCNavigationRequest("new", target), "root")
            val created = navigation.activeContextID
            assertNull(navigation.activeContext.parentID)
            navigation.navigate(AWCNavigationRequest("parent", "_parent"))
            assertEquals(created, navigation.activeContextID)
            navigation.navigate(AWCNavigationRequest("top", "_top"))
            assertEquals(created, navigation.activeContextID)
        }
        val count = navigation.contexts.size
        assertFalse(navigation.navigate(AWCNavigationRequest("next", "_wrong")))
        assertEquals(count, navigation.contexts.size)
    }

    @Test fun queryAndFragmentOnlyLinksRetainCurrentPagePath() {
        val navigation = AWCNavigationCoordinator("https://awc.local/demo/page?old=1#old")
        navigation.navigate(AWCNavigationRequest("?q=1#result", "_self"))
        assertEquals("https://awc.local/demo/page?q=1#result", navigation.activeContext.currentURL)
        navigation.navigate(AWCNavigationRequest("#section", "_self"))
        assertEquals("https://awc.local/demo/page?q=1#section", navigation.activeContext.currentURL)
    }

}
