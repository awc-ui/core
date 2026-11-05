package dev.awc.nativeui

import org.junit.Assert.*
import org.junit.Test

class NativeDividerContractTest {
    @Test fun appearanceKeepsSignedInsetsAndZeroWhileRejectingNonFiniteInputs() {
        val base = AWCDividerAppearance("#abcdef", 3.0, 12.0, 28.0)
        assertEquals(AWCDividerAppearance("#ABCDEF", 0.0, -12.0, 28.0),
            base.merged(AWCDividerAppearance(thickness = 0.0, insetStart = -12.0)))
        for (key in listOf("thickness", "insetStart", "insetEnd"))
            for (value in listOf(Double.NaN, Double.POSITIVE_INFINITY, true, "3"))
                assertEquals(AWCDividerAppearance(), AWCDividerAppearance.fromValues(mapOf(key to value)))
        assertNull(AWCDividerAppearance(thickness = -1.0).normalized().thickness)
        assertEquals(-12.0, AWCDividerAppearance.fromValues(mapOf("insetStart" to -12)).insetStart)
        assertNull(AWCDividerAppearance("red").normalized().color)
    }

    @Test fun conflictingFlagsFollowTheMeasuredWebCascade() {
        val oracle = listOf(0 to 0, 16 to 16, 16 to 0, 16 to 0, 0 to 16, 0 to 16, 0 to 16, 0 to 16)
        for (vertical in listOf(false, true)) for (flags in 0..7) {
            val m = NativeDividerMetrics.from(mapOf("vertical" to vertical, "inset" to (flags and 1 != 0),
                "insetStart" to (flags and 2 != 0), "insetEnd" to (flags and 4 != 0)), AWCDividerAppearance())
            assertEquals(vertical, m.vertical)
            assertEquals(1.0, m.thickness, 0.0)
            assertEquals(oracle[flags].first.toDouble(), m.start, 0.0)
            assertEquals(oracle[flags].second.toDouble(), m.end, 0.0)
        }
    }
}
