package dev.awc.nativeui

import org.junit.Assert.*
import org.junit.Test

class NativeThemeContractTest {
    @Test fun generatedRoleOverridesAreBoundedColorsOnly() {
        val value = normalizeAWCThemeOverrides(mapOf("--md-sys-color-primary" to "#aabbcc", "--md-sys-color-surface" to "#102030"))
        assertEquals("#AABBCC", value["--md-sys-color-primary"])
        assertEquals("#102030", value["--md-sys-color-surface"])
        assertEquals(37, AWCThemeColorRoles.size)
        for ((key, color) in listOf("--md-button-width" to "#123456", "--md-sys-color-primary" to "red", "--md-sys-color-primary" to "#12345678")) {
            try { normalizeAWCThemeOverrides(mapOf(key to color)); fail("Unsupported color accepted: $key=$color") }
            catch (_: IllegalArgumentException) { }
        }
        assertTrue(normalizeAWCThemeOverrides(emptyMap()).isEmpty())
    }
}
