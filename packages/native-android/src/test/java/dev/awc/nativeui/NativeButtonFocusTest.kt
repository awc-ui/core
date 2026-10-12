package dev.awc.nativeui

import org.junit.Assert.*
import org.junit.Test

class NativeButtonFocusTest {
    private fun entry(id: String, disabled: Boolean = false, selected: Boolean = false) = ButtonFocusEntry(id, AWCButtonFocusState().also { it.attached = true }, disabled, selected)
    @Test fun rovingEntryPrioritizesFocusThenSelectedThenEligibleAndRecoversRemoval() {
        val group = ButtonFocusGroup(true)
        group.update(entry("one")); group.update(entry("two", selected = true)); group.update(entry("off", disabled = true))
        assertEquals("two", group.active); assertEquals(-1, group.tabIndex("one")); assertEquals(0, group.tabIndex("two"))
        group.focused("one"); assertEquals("one", group.active)
        group.update(entry("one", disabled = true)); assertEquals("two", group.active)
        group.remove("two"); assertEquals("one", group.active)
        group.update(entry("soft")); assertEquals("soft", group.active)
    }
    @Test fun horizontalArrowsWrapSkipDisabledReverseRTLAndNeverChangeSelection() {
        val group = ButtonFocusGroup(true)
        group.update(entry("one", selected = true)); group.update(entry("off", disabled = true)); group.update(entry("soft")); group.update(entry("busy"))
        assertEquals("soft", group.destination("one", "ArrowRight", false))
        assertEquals("busy", group.destination("one", "ArrowLeft", false))
        assertEquals("busy", group.destination("one", "ArrowRight", true))
        assertEquals("one", group.destination("busy", "Home", true)); assertEquals("busy", group.destination("one", "End", false))
        assertNull(group.destination("one", "ArrowDown", false)); assertNull(group.destination("one", "Tab", false))
        assertTrue(group.move("one", "ArrowRight", false)); assertEquals("soft", group.active)
    }
    @Test fun tabindexAndRolePolicyAreExplicitAndMinusOneHasNativeRequestPath() {
        for (p in listOf(emptyMap(), mapOf("groupTabindex" to null), mapOf("groupTabindex" to 0), mapOf("softDisabled" to true), mapOf("loading" to true))) assertEquals(0, nativeButtonTabIndex(p, null, "id"))
        assertEquals(-1, nativeButtonTabIndex(mapOf("groupTabindex" to -1), null, "id"))
        assertEquals(-1, nativeButtonTabIndex(mapOf("disabled" to true), null, "id"))
        assertEquals("gridcell", nativeButtonRole(mapOf("roleOverride" to "gridcell")))
        assertEquals("button", nativeButtonRole(mapOf("roleOverride" to "unknown-role")))
        val focus = AWCButtonFocusState(); assertFalse(focus.requestFocus())
        focus.attached = true; assertTrue(focus.requestFocus()); assertTrue(focus.pending)
        focus.enabled = false; assertFalse(focus.requestFocus())
    }
    @Test fun multipleSelectionUsesFirstEntryUntilExplicitFocusAndNestedModelsStayIsolated() {
        val outer = ButtonFocusGroup(false); val inner = ButtonFocusGroup(true)
        outer.update(entry("one")); outer.update(entry("two", selected = true)); inner.update(entry("inner"))
        assertEquals("one", outer.active); inner.focused("inner"); assertEquals("one", outer.active)
        outer.focused("two"); assertEquals("two", outer.active)
    }
}
