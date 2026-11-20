package dev.awc.nativeui

import androidx.compose.ui.geometry.Size
import org.junit.Assert.*
import org.junit.Test

/** S7-6-03: named tests for --md-menu-viewport-margin and --md-menu-section-gap with non-default values. */
class NativeMenuHookTest {
    private val vp=Size(400f,700f)
    @Test fun viewportMarginSizesTheResponsiveSheetAndTheCaps() {
        val model=NativeMenuModel(responsive=true)
        assertEquals("--md-menu-viewport-margin default 8px: responsive width",384.0,NativeMenuPlacement.width(null,200.0,vp,model,AWCMenuAppearance()),0.001)
        assertEquals("--md-menu-viewport-margin 24px: responsive width",352.0,NativeMenuPlacement.width(null,200.0,vp,model,AWCMenuAppearance(viewportMargin="24px")),0.001)
        assertEquals("--md-menu-viewport-margin 8px caps max-block-size at 100dvh - 2 x margin",684.0,NativeMenuPlacement.defaultCap(NativeMenuModel(),AWCMenuAppearance(maxBlockSize="1000px"),vp,8.0),0.001)
        val a=AWCMenuAppearance(maxBlockSize="1000px",viewportMargin="50px")
        assertEquals("--md-menu-viewport-margin 50px cap",600.0,NativeMenuPlacement.defaultCap(NativeMenuModel(),a,vp,NativeMenuPlacement.margin(a,vp)),0.001)
    }
    @Test fun sectionGapIsTheSpaceUnderAGapRow() {
        assertEquals("--md-menu-section-gap default 2px",2.0,NativeMenuPlacement.sectionGap(AWCMenuAppearance(),vp),0.001)
        assertEquals("--md-menu-section-gap 10px",10.0,NativeMenuPlacement.sectionGap(AWCMenuAppearance(sectionGap="10px"),vp),0.001)
        assertEquals("--md-menu-section-gap 5vh",35.0,NativeMenuPlacement.sectionGap(AWCMenuAppearance.fromCss(mapOf("--md-menu-section-gap" to "5vh")),vp),0.001)
    }
}
