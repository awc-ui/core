package dev.awc.nativeui

import org.junit.Assert.*
import org.junit.Test

class NativeButtonContractTest {
    @Test fun actualSourceSizeLadderAndDensityFloors() {
        val sizes=listOf("xs","sm","md","lg","xl")
        assertEquals(listOf(32f,40f,56f,96f,136f),sizes.map { NativeButtonMetrics(it,0f,"filled").height })
        assertEquals(listOf(12f,16f,24f,48f,64f),sizes.map { NativeButtonMetrics(it,0f,"filled").padding })
        assertEquals(listOf(12f,24f,28f,32f,48f),sizes.map { NativeButtonMetrics(it,0f,"outlined").padding })
        val dense=NativeButtonMetrics("xs",-4f,"filled")
        assertEquals(24f,dense.height,0f);assertEquals(40f,dense.minimumWidth,0f)
        assertEquals(10f,dense.icon,0f);assertEquals(10f,dense.fontSize,0f)
        assertEquals(56f,NativeButtonMetrics("md",-1.5f,"filled").height,0f)
    }
    @Test fun pressAndToggleMorphUseDifferentSourceRadii() {
        val metrics=NativeButtonMetrics("md",0f,"filled")
        assertEquals(28f,metrics.radius(false,true,false,false),0f)
        assertEquals(12f,metrics.radius(false,true,true,false),0f)
        assertEquals(8f,metrics.radius(false,true,true,true),0f)
        assertEquals(28f,metrics.radius(true,true,true,false),0f)
        assertEquals(28f,metrics.radius(false,false,true,true),0f)
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
