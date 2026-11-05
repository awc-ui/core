package dev.awc.nativeui

import org.junit.Assert.*
import org.junit.Test

class AWCButtonAppearanceTest {
    private val ranges = mapOf(
        "iconSize" to (8.0 to 128.0), "trailingIconSize" to (8.0 to 128.0), "loadingSize" to (8.0 to 128.0),
        "fontSize" to (8.0 to 96.0), "fontWeight" to (100.0 to 900.0), "lineHeight" to (8.0 to 160.0),
        "letterSpacing" to (-5.0 to 20.0), "cornerRadius" to (0.0 to 200.0), "outlineWidth" to (0.0 to 16.0),
        "paddingInline" to (0.0 to 128.0), "paddingBlock" to (0.0 to 128.0), "gap" to (0.0 to 64.0),
        "hoverOpacity" to (0.0 to 1.0), "focusOpacity" to (0.0 to 1.0), "pressedOpacity" to (0.0 to 1.0),
        "width" to (0.0 to 2400.0), "minWidth" to (0.0 to 2400.0), "maxWidth" to (0.0 to 2400.0),
        "height" to (0.0 to 2400.0), "minHeight" to (0.0 to 2400.0),
    )

    @Test fun acceptsEverySharedNumericBoundaryAndRejectsMalformedFieldsIndividually() {
        for ((field, range) in ranges) {
            for (value in listOf(range.first, range.second)) {
                assertEquals(field, value, AWCButtonAppearance.fromValues(mapOf(field to value)).values[field])
            }
            for (value in listOf<Any>(range.first - 1, range.second + 1, Double.NaN, Double.POSITIVE_INFINITY, "12", true)) {
                assertFalse("$field rejects $value", AWCButtonAppearance.fromValues(mapOf(field to value)).values.containsKey(field))
            }
        }
        assertNull(AWCButtonAppearance(fontWeight = 500.5).normalized().fontWeight)
        assertEquals(500.0, AWCButtonAppearance.fromValues(mapOf("fontWeight" to 500)).fontWeight)
    }

    @Test fun acceptsSixAndEightDigitHexColorsAndDropsUnknownFields() {
        val fields = listOf("containerColor", "labelColor", "iconColor", "trailingIconColor", "loadingColor", "stateLayerColor", "outlineColor", "focusRingColor")
        for (field in fields) {
            assertEquals("#ABCDEF", AWCButtonAppearance.fromValues(mapOf(field to "#aBcDeF")).values[field])
            assertEquals("#ABCDEF80", AWCButtonAppearance.fromValues(mapOf(field to "#aBcDeF80")).values[field])
            for (value in listOf<Any>("red", "#fff", "#1122334", "#112233445", " #123456", "rgb(1,2,3)", 123456)) {
                assertTrue(AWCButtonAppearance.fromValues(mapOf(field to value)).values.isEmpty())
            }
        }
        assertTrue(AWCButtonAppearance.fromValues(mapOf("unsupported" to 12)).values.isEmpty())
    }

    @Test fun nestedOverridesMergeFieldwiseAndInvalidLocalValuesRetainDefaults() {
        val app = AWCButtonAppearance(labelColor = "#aabbcc", iconSize = 32.0, cornerRadius = 12.0, fontWeight = 500.0)
        val local = AWCButtonAppearance(labelColor = "invalid", trailingIconColor = "#112233", cornerRadius = 0.0, fontWeight = 900.0)
        val merged = app.merged(local)
        assertEquals("#AABBCC", merged.labelColor)
        assertEquals("#112233", merged.trailingIconColor)
        assertEquals(32.0, merged.iconSize)
        assertEquals(0.0, merged.cornerRadius)
        assertEquals(900.0, merged.fontWeight)
        assertEquals(app.normalized(), app.merged(AWCButtonAppearance()))
    }
}
