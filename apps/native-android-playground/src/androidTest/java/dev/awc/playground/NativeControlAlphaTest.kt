package dev.awc.playground

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.*
import dev.awc.nativeui.*
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

class NativeControlAlphaTest {
    @get:Rule val compose=createComposeRule()
    @Test fun buttonAndIconPaintActualRgbaWithoutReorderingOrDroppingAlpha() {
        compose.setContent { CompositionLocalProvider(LocalDensity provides Density(2f,1f)) {
            AWCTheme(false) {
                Column(Modifier.requiredSize(240.dp,160.dp).background(Color.White).testTag("alpha")) {
                    AWCButtonAppearanceScope(AWCButtonAppearance(containerColor="#0000FF80",labelColor="#FF000080",width=180.0,height=56.0)) {
                        AWCComponent("md-button",mapOf("label" to "Alpha","variant" to "filled","motion" to false))
                    }
                    AWCIconButtonAppearanceScope(AWCIconButtonAppearance(iconColor="#FF000080",width=56.0,height=56.0)) {
                        AWCComponent("md-icon-button",mapOf("icon" to "close","variant" to "standard"))
                    }
                }
            }
        } }
        compose.waitForIdle()
        val image=compose.onNodeWithTag("alpha").captureToImage().toPixelMap()
        val background=image[80,15]
        assertEquals(.498,background.red.toDouble(),.01);assertEquals(.498,background.green.toDouble(),.01);assertEquals(1.0,background.blue.toDouble(),.01)
        var label=0;var icon=0
        for(y in 0 until 112) for(x in 0 until 360) {
            val c=image[x,y]
            // 50% red label over the 50% blue container on white.
            if(c.red in .73f.. .77f && c.green in .23f.. .27f && c.blue in .48f.. .52f) label++
        }
        for(y in 112 until 224) for(x in 0 until 112) {
            val c=image[x,y]
            if(c.red>.99f && c.green in .48f.. .52f && c.blue in .48f.. .52f) icon++
        }
        assertTrue("Real Button glyph retains authored half opacity",label>8)
        assertTrue("Real Icon Button glyph retains authored half opacity",icon>8)
    }
}
