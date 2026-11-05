package dev.awc.playground

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.PixelMap
import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import dev.awc.nativeui.*
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

/** md-chip paints its ✕ (remove) and ✓ (selected filter) glyphs inside their 18 dp boxes, as the source draws them. */
class NativeChipGlyphTest {
    @get:Rule val compose = createComposeRule()
    private var props by mutableStateOf(mapOf<String, Any?>("label" to "Alex Morgan", "variant" to "input", "removable" to true))
    private fun ink(px: PixelMap, x0: Int, x1: Int): Int { var n = 0
        for (y in 0 until px.height) for (x in x0 until minOf(x1, px.width)) { val c = px[x, y]; if ((c.red + c.green + c.blue) / 3 < .55f && c.alpha > .5f) n++ }
        return n }
    @Test fun removeAndCheckmarkGlyphsPaint() {
        compose.setContent { AWCTheme(darkTheme = false) { CompositionLocalProvider(LocalDensity provides Density(2f, 1f)) { Box(Modifier.padding(24.dp)) { AWCComponent("md-chip", props) } } } }
        compose.waitForIdle()
        val remove = compose.onNode(hasContentDescription("Remove Alex Morgan"), useUnmergedTree = true).captureToImage().toPixelMap()
        val x = ink(remove, 0, remove.width)
        assertTrue("the ✕ glyph paints inside the remove button ($x dark device pixels)", x >= 20)
        props = mapOf("label" to "Design system", "variant" to "filter", "selected" to true); compose.waitForIdle()
        val chip = compose.onNode(hasText("Design system")).captureToImage().toPixelMap()
        // Leading inset 8 dp, then the 18 dp checkmark (density 2: device pixels 16..52); the label starts after an 8 dp gap.
        val check = ink(chip, 16, 52)
        assertTrue("the ✓ glyph paints in the leading checkmark box ($check dark device pixels)", check >= 20)
    }
}
