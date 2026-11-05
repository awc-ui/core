package dev.awc.nativeui

import org.junit.Assert.*
import org.junit.Test

class NativeStatusDotContractTest {
    @Test fun typedHooksCascadeWithoutLosingZeroAlphaOrSignedInsets() {
        val base = AWCStatusDotAppearance(size = 20.0, color = "#abcdef", pulseColor = "#12345680",
            insetEnd = AWCStatusDotInset(-2.0, .25))
        val result = base.merged(AWCStatusDotAppearance(outlineWidth = 0.0, pulseDuration = 0.0))
        assertEquals(20.0, result.size); assertEquals("#ABCDEF", result.color)
        assertEquals("#12345680", result.pulseColor); assertEquals(base.insetEnd, result.insetEnd)
        assertEquals(0.0, result.outlineWidth); assertEquals(0.0, result.pulseDuration)
        for (key in listOf("size", "outlineWidth", "pulseDuration"))
            for (invalid in listOf(-1, true, "4", Double.NaN, Double.POSITIVE_INFINITY))
                assertEquals(AWCStatusDotAppearance(), AWCStatusDotAppearance.fromValues(mapOf(key to invalid)))
        for (invalid in listOf(3, "50%", mapOf("points" to true), mapOf("fraction" to ".5"),
            mapOf("unexpected" to 0), mapOf("fraction" to Double.NaN)))
            assertNull(AWCStatusDotAppearance.fromValues(mapOf("insetEnd" to invalid)).insetEnd)
    }

    @Test fun anchorsUseParentPercentagesLogicalEndAndCustomOverrides() {
        val rect = NativeStatusDotMetrics.from(emptyMap(), AWCStatusDotAppearance())
        assertEquals(38.0 to 38.0, rect.position(48.0, 48.0, false))
        assertEquals(-2.0 to 38.0, rect.position(48.0, 48.0, true))
        val circle = NativeStatusDotMetrics.from(mapOf("shape" to "circle"), AWCStatusDotAppearance())
        assertEquals(34.970544, circle.position(48.0, 64.0, false).first, .000001)
        assertEquals(48.627392, circle.position(48.0, 64.0, false).second, .000001)
        val custom = NativeStatusDotMetrics.from(mapOf("shape" to "circle"),
            AWCStatusDotAppearance(insetEnd = AWCStatusDotInset(3.0, .5), insetBlockEnd = AWCStatusDotInset(-4.0, .25)))
        assertEquals(9.0 to 40.0, custom.position(48.0, 64.0, false))
    }

    @Test fun inheritedDensityAndPhysicalOutlineSnappingPreserveSourceRules() {
        for (p in listOf(emptyMap<String, AWCValue>(), mapOf("density" to 0))) {
            val m = NativeStatusDotMetrics.from(p, AWCStatusDotAppearance(), -1.5, 2.0)
            assertEquals(9.75, m.diameter, .0); assertEquals(1.5, m.outlineWidth, .0)
        }
        val m = NativeStatusDotMetrics.from(mapOf("density" to -2), AWCStatusDotAppearance(), -4.0, 2.0)
        assertEquals(9.0, m.diameter, .0)
        for (width in listOf(.1, .5, .75))
            assertEquals(.5, NativeStatusDotMetrics.from(emptyMap(), AWCStatusDotAppearance(outlineWidth = width),
                displayScale = 2.0).outlineWidth, .0)
        assertEquals(0.0, NativeStatusDotMetrics.from(emptyMap(), AWCStatusDotAppearance(outlineWidth = 0.0)).outlineWidth, .0)
        assertEquals(0.0, NativeStatusDotMetrics.from(mapOf("inline" to true, "size" to "large"), AWCStatusDotAppearance()).outlineWidth, .0)
    }

    @Test fun pulseMatchesPausedCssSamplesAndHasTransparentFiniteEndpoint() {
        val middle = NativeStatusDotPulse.at(.35)
        assertEquals(5.47715, middle.spread, .00001)
        assertEquals(.173, middle.opacity * .55, .001)
        assertEquals(8.0, NativeStatusDotPulse.at(.7).spread, .00001)
        assertEquals(0.0, NativeStatusDotPulse.at(.7).opacity, .0)
        assertEquals(0.0, NativeStatusDotPulse.at(1.0).spread, .00001)
        assertEquals(0.0, NativeStatusDotPulse.at(1.0).opacity, .0)
    }

    @Test fun labelsUseEcmaWhitespaceAndRgbaKeepsByteOrder() {
        fun label(value: String) = NativeStatusDotMetrics.from(mapOf("label" to value), AWCStatusDotAppearance()).label
        assertEquals("", label("\uFEFF\u00A0"))
        assertEquals("\u0085", label("\u0085"))
        assertEquals(" Available ", label(" Available "))
        val color = statusDotColor("#12345680")
        assertEquals(18f / 255, color.red, .00001f)
        assertEquals(52f / 255, color.green, .00001f)
        assertEquals(86f / 255, color.blue, .00001f)
        assertEquals(128f / 255, color.alpha, .00001f)
    }
}
