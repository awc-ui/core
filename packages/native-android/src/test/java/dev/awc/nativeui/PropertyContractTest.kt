package dev.awc.nativeui

import org.junit.Assert.*
import org.junit.Test

class PropertyContractTest {
    @Test fun genericPropertiesMatchGeneratedDefaultsWithExplicitOverrides() {
        val properties = awcProperties("md-progress-indicator", mapOf("value" to 50))
        assertEquals(100f, properties.num("max"), 0f)
        assertEquals(50f, properties.num("value"), 0f)
        assertEquals(200f, awcProperties("md-progress-indicator", mapOf("max" to 200)).num("max"), 0f)
    }

    @Test fun propertyReadersRespectFalseAndZero() {
        val props: Props = mapOf("selected" to false, "value" to 0, "label" to "", "max" to "25")
        assertFalse(props.bool("selected", true))
        assertEquals(0f, props.num("value", 10f), 0f)
        assertEquals(25, props.int("max"))
        assertEquals("", props.str("label", "fallback"))
    }

    @Test fun choicesKeepStableValuesAndDisabledFlags() {
        val props: Props = mapOf("options" to listOf(mapOf("value" to "a", "label" to "Alpha"), mapOf("value" to "b", "label" to "Beta", "disabled" to true)))
        assertEquals(listOf("a", "b"), props.choices().map { it.value })
        assertTrue(props.choices()[1].disabled)
    }

    @Test fun softDisabledBlocksInteraction() { assertFalse(mapOf<String, AWCValue>("softDisabled" to true).enabled()) }
}
