package dev.awc.nativeui

import org.junit.Assert.*
import org.junit.Test

class GroupContractTest {
    @Test fun exclusiveSegmentsUseIdentityWhenValuesAreDuplicated() {
        val events = mutableListOf<AWCValue>()
        val scope = SelectionScope("md-segmented-button-set", emptyMap()) { _, value -> events += value }
        val a = Any(); val b = Any()
        scope.register(a, "", false); scope.register(b, "", false)
        scope.toggle(a); scope.toggle(b)
        assertFalse(scope.states[a]!!); assertTrue(scope.states[b]!!)
        assertEquals(listOf(""), events.last())
        scope.toggle(b)
        assertTrue(scope.states[b]!!)
    }

    @Test fun requiredButtonGroupCannotDeselectLastValue() {
        val scope = SelectionScope("md-button-group", mapOf("required" to true, "selectionMode" to "multi-select")) { _, _ -> }
        val a = Any(); val b = Any()
        scope.register(a, "a", true); scope.register(b, "b", true)
        scope.toggle(a); scope.toggle(b)
        assertFalse(scope.states[a]!!); assertTrue(scope.states[b]!!)
    }

    @Test fun zeroLimitsMeanUnlimitedLikeTheSourceContract() {
        assertEquals(Int.MAX_VALUE, mapOf<String, AWCValue>("maxSelected" to 0).limit("maxSelected"))
        assertEquals(3, mapOf<String, AWCValue>("maxSelected" to 3).limit("maxSelected"))
    }
}
