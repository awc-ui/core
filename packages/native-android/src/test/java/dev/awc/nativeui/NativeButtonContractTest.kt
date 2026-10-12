package dev.awc.nativeui

import org.junit.Assert.*
import org.junit.Test

class NativeButtonContractTest {
    private val sizes = listOf("xs", "sm", "md", "lg", "xl")

    @Test fun expressiveMetricsMatchAuditedSizeLadder() {
        val metrics = sizes.map { NativeButtonMetrics(it, 0f, "filled") }
        assertEquals(listOf(32f, 40f, 56f, 96f, 136f), metrics.map { it.height })
        assertEquals(listOf(20f, 20f, 24f, 32f, 40f), metrics.map { it.icon })
        assertEquals(listOf(4f, 8f, 8f, 12f, 16f), metrics.map { it.gap })
        assertEquals(listOf(14f, 14f, 16f, 24f, 32f), metrics.map { it.fontSize })
        assertEquals(listOf(20f, 20f, 24f, 32f, 40f), metrics.map { it.lineHeight })
        assertEquals(listOf("label-large", "label-large", "title-medium", "headline-small", "headline-large"), metrics.map { it.typeRole })
        assertEquals(listOf(500, 500, 500, 400, 400), metrics.map { it.weight })
        assertEquals(listOf(.1f, .1f, .15f, 0f, 0f), metrics.map { it.tracking })
        assertEquals(listOf(12f, 12f, 16f, 28f, 28f), metrics.map { it.squareRadius })
        assertEquals(listOf(8f, 8f, 12f, 16f, 16f), metrics.map { it.pressedRadius })
        assertEquals(listOf(16f, 20f, 28f, 48f, 68f), metrics.map { it.roundRadius })
        assertEquals(listOf(4f, 8f, 8f, 16f, 20f), metrics.map { it.connectedRadius })
    }

    @Test fun outlinedStrokeIsIncludedInTheStandardOuterInset() {
        assertEquals(listOf(1f, 1f, 1f, 2f, 3f), sizes.map { NativeButtonMetrics(it, 0f, "outlined").outlineWidth })
        assertEquals(listOf(12f, 16f, 24f, 48f, 64f), sizes.map { NativeButtonMetrics(it, 0f, "outlined").padding })
        val denseInsets = listOf(9f, 12f, 18f, 36f, 48f)
        assertEquals(denseInsets, sizes.map { NativeButtonMetrics(it, -4f, "outlined").padding })
        for (density in listOf(0f, -1f, -2f, -3f, -4f)) {
            for (size in sizes) {
                assertEquals("$size at density $density must align across variants",
                    NativeButtonMetrics(size, density, "filled").padding,
                    NativeButtonMetrics(size, density, "outlined").padding, 0f)
            }
        }
    }

    @Test fun denseTypographyUsesTheAuditedTapersWithoutChangingOtherMetrics() {
        assertEquals(listOf(13.5f, 13.5f, 15.5f, 23f, 30f), sizes.map { NativeButtonMetrics(it, -1f, "filled").fontSize })
        assertEquals(listOf(19f, 19f, 23f, 30f, 38f), sizes.map { NativeButtonMetrics(it, -1f, "filled").lineHeight })
        assertEquals(listOf(12f, 12f, 14f, 20f, 24f), sizes.map { NativeButtonMetrics(it, -4f, "filled").fontSize })
        assertEquals(listOf(16f, 16f, 20f, 24f, 32f), sizes.map { NativeButtonMetrics(it, -4f, "filled").lineHeight })
        val dense = NativeButtonMetrics("xs", -4f, "filled")
        assertEquals(24f, dense.height, 0f)
        assertEquals(40f, dense.minimumWidth, 0f)
        assertEquals(10f, dense.icon, 0f)
        assertEquals(56f, NativeButtonMetrics("md", -1.5f, "filled").height, 0f)
    }

    @Test fun pressAndToggleMorphUseDifferentSourceRadii() {
        val metrics = NativeButtonMetrics("md", 0f, "filled")
        assertEquals(28f, metrics.radius(false, true, false, false), 0f)
        assertEquals(16f, metrics.radius(false, true, true, false), 0f)
        assertEquals(12f, metrics.radius(false, true, true, true), 0f)
        assertEquals(28f, metrics.radius(true, true, true, false), 0f)
        assertEquals(28f, metrics.radius(false, false, true, true), 0f)
    }
    @Test fun toggleAndDisabledPalettesFollowSourceCascade() {
        assertEquals("surface-container-highest",NativeButtonPalette.resolve("filled",true,false,false).container)
        assertEquals("on-primary",NativeButtonPalette.resolve("filled",true,true,false).label)
        assertEquals("secondary-container",NativeButtonPalette.resolve("outlined",true,true,false).container)
        assertNull(NativeButtonPalette.resolve("outlined",true,true,false).outline)
        assertEquals(0,NativeButtonPalette.resolve("elevated",true,false,false).elevation)
        assertEquals("on-surface",NativeButtonPalette.resolve("tonal",true,true,true).label)
    }
    @Test fun loaderClosesSourcePolygonsAndPreservesSpringOvershoot() {
        assertEquals(8,NativeButtonLoadingMotion.polygons.size)
        assertTrue(NativeButtonLoadingMotion.polygons.all { it.size==48 })
        assertEquals(.5f,NativeButtonLoadingMotion.polygons.first().first().x,0f)
        assertEquals(.053f,NativeButtonLoadingMotion.polygons.first().first().y,.000001f)
        assertEquals(NativeButtonLoadingMotion.polygons.first(),NativeButtonLoadingMotion.polygons.last())
        assertEquals(154f,NativeButtonLoadingMotion.sample(4.55f*.143f).second,.002f)
        assertTrue(NativeButtonLoadingMotion.cubic(.7f,.34f,1.45f,.4f,1f)>1f)
    }
}
