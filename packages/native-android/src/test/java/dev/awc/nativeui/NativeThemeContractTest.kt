package dev.awc.nativeui

import org.junit.Assert.*
import org.junit.Test

class NativeThemeContractTest {
    @Test fun generatedRoleOverridesAreBoundedColorsOnly() {
        val value = normalizeAWCThemeOverrides(mapOf("--md-sys-color-primary" to "#aabbcc", "--md-sys-color-surface" to "#102030"))
        assertEquals("#AABBCC", value["--md-sys-color-primary"])
        assertEquals("#102030", value["--md-sys-color-surface"])
        assertEquals(37, AWCThemeColorRoles.size)
        for ((key, color) in listOf("--md-button-width" to "#123456", "--md-sys-color-primary" to "red")) {
            try { normalizeAWCThemeOverrides(mapOf(key to color)); fail("Unsupported color accepted: $key=$color") }
            catch (_: IllegalArgumentException) { }
        }
        assertTrue(normalizeAWCThemeOverrides(emptyMap()).isEmpty())
        val custom=normalizeAWCThemeOverrides(mapOf("--md-sys-color-Brand" to "#12345680","--md-sys-color-brand-container" to "#abcdef80"))
        assertEquals("#12345680",custom["--md-sys-color-Brand"])
        assertFalse(custom.containsKey("--md-sys-color-brand"))
        assertEquals("#ABCDEF80",custom["--md-sys-color-brand-container"])
        for(values in listOf((0..128).associate { "--md-sys-color-role-$it" to "#123456" },mapOf("--md-sys-color-"+"a".repeat(90) to "#123456"))) {
            try { normalizeAWCThemeOverrides(values);fail("Unbounded theme accepted") } catch(_:IllegalArgumentException) {}
        }
    }
}
