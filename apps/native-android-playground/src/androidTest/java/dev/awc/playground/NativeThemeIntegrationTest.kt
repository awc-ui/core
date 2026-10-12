package dev.awc.playground

import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.LayoutDirection
import dev.awc.nativeui.AWCTheme
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

class NativeThemeIntegrationTest {
    @get:Rule val compose = createComposeRule()

    @Test fun generatedColorsReachActualComposeThemeAndDirection() {
        var seenPrimary: Color? = null
        var seenSecondary: Color? = null
        var seenSurface: Color? = null
        var seenDirection: LayoutDirection? = null
        compose.setContent {
            CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
                AWCTheme(darkTheme = true, tokenOverrides = mapOf(
                    "--md-sys-color-primary" to "#12A456", "--md-sys-color-secondary" to "#ABCDEF", "--md-sys-color-surface" to "#172839",
                )) {
                    val colors = MaterialTheme.colorScheme
                    val direction = LocalLayoutDirection.current
                    SideEffect { seenPrimary = colors.primary; seenSecondary = colors.secondary; seenSurface = colors.surface; seenDirection = direction }
                }
            }
        }
        compose.runOnIdle {
            assertEquals(Color(0xFF12A456), seenPrimary)
            assertEquals(Color(0xFFABCDEF), seenSecondary)
            assertEquals(Color(0xFF172839), seenSurface)
            assertEquals(LayoutDirection.Rtl, seenDirection)
        }
    }
}
