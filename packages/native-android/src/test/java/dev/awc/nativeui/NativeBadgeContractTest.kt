package dev.awc.nativeui

import androidx.compose.ui.unit.IntOffset
import org.junit.Assert.*
import org.junit.Test

class NativeBadgeContractTest {
    @Test fun valuesUseEcmaNumericParsingAndFourUtf16Units() {
        val cases = listOf(
            Triple("", 999.0, ""), Triple("HELLO", 999.0, "HELL"), Triple("ABC😀", 999.0, "ABC�"),
            Triple("😀😀😀", 999.0, "😀😀"), Triple("0x100", 9.0, "9+"), Triple("0b1111", 9.0, "9+"),
            Triple("0o17", 9.0, "9+"), Triple("+0x100", 9.0, "+0x1"), Triple("Infinity", 9.0, "Infi"),
            Triple("1e3", 9.0, "9+"), Triple("99.5", 9.0, "9+"), Triple("  ", 9.0, "  "),
            Triple("\uFEFF", -1.0, "-1+"), Triple("-25", 9.0, "-25"), Triple("10", 2.5, "2.5+"),
            Triple("1000000", 99999.0, "99999+"), Triple("1e24", 1e23, "1e+23+"),
            Triple("10", 1e-7, "1e-7+"), Triple("10", 1e-6, "0.000001+"),
            Triple("-0", -1.0, "-1+"), Triple("1e22", 1e20, "100000000000000000000+"))
        for ((value, maximum, expected) in cases) {
            assertEquals(value, expected, NativeBadgeValue.display(mapOf("value" to value, "max" to maximum)))
            assertEquals("", NativeBadgeValue.display(mapOf("value" to value, "max" to maximum, "variant" to "small")))
        }
        for (invalid in listOf("1_000", "1,000", "0x", "0b2", "0o8", "1e999", "\u0085", "\u180E"))
            assertNull(invalid, NativeBadgeValue.number(invalid))
        assertEquals("A B",NativeBadgeValue.visual(" A\tB "))
        assertEquals("",NativeBadgeValue.visual(" \n\r\t\u000C"))
        assertEquals("\u00A0",NativeBadgeValue.visual("\u00A0"))
        assertEquals("5e-324", NativeBadgeValue.formatted(Double.MIN_VALUE))
        assertEquals("1e+23", NativeBadgeValue.formatted(1e23))
    }
    @Test fun allTenHooksCascadeWithoutLosingZeroOrStructuredOffsets() {
        val base = AWCBadgeAppearance(containerColor = "#abcdef", iconSize = 20.0,
            offsetX = AWCBadgeOffset(fraction = .5), largePadding = AWCBadgePadding(right = 4.0, left = 4.0))
        val actual = base.merged(AWCBadgeAppearance(largeHeight = 0.0, largePadding = AWCBadgePadding(), smallSize = 0.0))
        assertEquals("#ABCDEF", actual.containerColor); assertEquals(20.0, actual.iconSize)
        assertEquals(AWCBadgeOffset(fraction = .5), actual.offsetX)
        assertEquals(AWCBadgePadding(), actual.largePadding); assertEquals(0.0, actual.largeHeight)
        for (key in listOf("cornerRadius", "iconSize", "largeHeight", "smallSize"))
            for (invalid in listOf(Double.NaN, Double.POSITIVE_INFINITY, true, "3", -1))
                assertEquals(AWCBadgeAppearance(), AWCBadgeAppearance.fromValues(mapOf(key to invalid)))
        for (invalid in listOf(emptyList<Any>(), listOf(1, 2), listOf(1, 2, 3, -1), listOf(1, "2", 3, 4)))
            assertNull(AWCBadgeAppearance.fromValues(mapOf("largePadding" to invalid)).largePadding)
        for (invalid in listOf(3, "50%", mapOf("points" to true), mapOf("fraction" to "0.5"),
            mapOf("unexpected" to 0), mapOf("points" to Double.POSITIVE_INFINITY)))
            assertNull(AWCBadgeAppearance.fromValues(mapOf("offsetX" to invalid)).offsetX)
        assertEquals(AWCBadgeOffset(fraction = .5), AWCBadgeAppearance.fromValues(mapOf("offsetX" to mapOf("fraction" to .5))).offsetX)
    }
    @Test fun zeroAndOmittedDensityInheritWhileNegativeLocalDensityOverrides() {
        for(properties in listOf(emptyMap<String,AWCValue>(),mapOf("density" to 0))) {
            val metrics=NativeBadgeMetrics.from(properties,AWCBadgeAppearance(),-4.0)
            assertEquals(12.0,metrics.height,.0);assertEquals(8.0,metrics.iconSize,.0)
        }
        val local=NativeBadgeMetrics.from(mapOf("density" to -1),AWCBadgeAppearance(),-4.0)
        assertEquals(15.0,local.height,.0);assertEquals(9.5,local.iconSize,.0)
    }

    @Test fun physicalAnchorUsesParentShapeAndOwnSizeFractions() {
        val rect = NativeBadgePlacement.from(emptyMap(), AWCBadgeAppearance())
        assertEquals(IntOffset(70, -8), rect.position(80, 64, 20, 16, 1f))
        val circle = NativeBadgePlacement.from(mapOf("shape" to "circle"), AWCBadgeAppearance())
        assertEquals(IntOffset(58, 1), circle.position(80, 64, 20, 16, 1f))
        val custom = NativeBadgePlacement.from(mapOf("shape" to "circle"),
            AWCBadgeAppearance(offsetX = AWCBadgeOffset(7.0, .5), offsetY = AWCBadgeOffset(-3.0, -.5)))
        assertEquals(IntOffset(65, -2), custom.position(80, 64, 20, 16, 1f))
        assertEquals(IntOffset(131, -3), custom.position(160, 128, 40, 32, 2f))
    }
}
