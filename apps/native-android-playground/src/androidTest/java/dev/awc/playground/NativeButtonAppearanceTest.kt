package dev.awc.playground

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.LocalTextStyle
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.awc.nativeui.*
import dev.awc.nativeui.generated.*
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import kotlin.math.abs

/** Raster, layout, slot and interaction checks using the public generated button API. */
class NativeButtonAppearanceTest {
    @get:Rule val compose = createComposeRule()

    @Test fun nestedScopesStyleSlotsAndTypographyWithOuterInsetsAndRtl() {
        var rtl by mutableStateOf(false)
        var style: TextStyle? = null
        compose.setContent { AWCTheme(darkTheme = false) {
            CompositionLocalProvider(LocalLayoutDirection provides if(rtl) LayoutDirection.Rtl else LayoutDirection.Ltr) {
                AWCButtonAppearanceScope(AWCButtonAppearance(containerColor = "#FFFFFF", iconColor = "#FF0000",
                    labelColor = "#0000FF", iconSize = 24.0, fontSize = 22.0, fontWeight = 700.0, lineHeight = 30.0,
                    letterSpacing = 1.5, outlineWidth = 4.0, outlineColor = "#000000", paddingInline = 24.0,
                    paddingBlock = 10.0, gap = 12.0, cornerRadius = 0.0)) {
                    AWCButtonAppearanceScope(AWCButtonAppearance(trailingIconColor = "#00FF00", trailingIconSize = 32.0)) {
                        AWCButton(modifier = Modifier.testTag("button")) { slot ->
                            when(slot) {
                                "leading-icon", "trailing-icon" -> Box(Modifier.size(80.dp).background(LocalContentColor.current).testTag(slot))
                                "" -> {
                                    style = LocalTextStyle.current
                                    Box(Modifier.size(40.dp, 30.dp).background(LocalContentColor.current).testTag("label"))
                                }
                            }
                        }
                    }
                }
            }
        } }
        for(direction in listOf(false, true)) {
            compose.runOnIdle { rtl = direction }
            val bounds = compose.onNodeWithTag("button", true).fetchSemanticsNode().boundsInRoot
            val leading = compose.onNodeWithTag("leading-icon", true).fetchSemanticsNode().boundsInRoot
            val trailing = compose.onNodeWithTag("trailing-icon", true).fetchSemanticsNode().boundsInRoot
            val label = compose.onNodeWithTag("label", true).fetchSemanticsNode().boundsInRoot
            val density = compose.density.density
            assertEquals(24f * density, leading.width, 1f)
            assertEquals(32f * density, trailing.width, 1f)
            assertEquals(24f * density, if(rtl) bounds.right - leading.right else leading.left - bounds.left, 1f)
            assertEquals(24f * density, if(rtl) trailing.left - bounds.left else bounds.right - trailing.right, 1f)
            assertEquals(12f * density, if(rtl) leading.left - label.right else label.left - leading.right, 1f)
            assertEquals(14f * density, trailing.top - bounds.top, 1f)
            val image = compose.onNodeWithTag("button").captureToImage()
            assertTrue(image.count(Color.Red) > 100)
            assertTrue(image.count(Color.Green) > 100)
            assertTrue(image.count(Color.Blue) > 100)
            assertEquals(22f, style!!.fontSize.value, 0f)
            assertEquals(700, style!!.fontWeight!!.weight)
            assertEquals(30f, style!!.lineHeight.value, 0f)
            assertEquals(1.5f, style!!.letterSpacing.value, 0f)
        }
    }

    @Test fun nativeGlyphsUseIndependentColorsAndTrailingSizeInheritsLeading() {
        var disabled by mutableStateOf(false)
        compose.setContent { AWCTheme(darkTheme = false) {
            Box(Modifier.background(Color.White).padding(16.dp)) {
                AWCButtonAppearanceScope(AWCButtonAppearance(containerColor = "#FFFFFF", labelColor = "#0000FF",
                    iconColor = "#FF0000", trailingIconColor = "#00FF00", iconSize = 32.0, fontSize = 24.0)) {
                    AWCButton(AWCButtonProperties(icon = "home", trailingIcon = "add", disabled = disabled), Modifier.testTag("button")) {
                        if(it == "") Text("Continue")
                    }
                }
            }
        } }
        val initial = compose.onNodeWithTag("button").captureToImage()
        assertTrue("Leading native glyph is red", initial.count(Color.Red) > 10)
        assertTrue("Trailing native glyph is green", initial.count(Color.Green) > 10)
        assertTrue("Native text is blue", initial.count(Color.Blue) > 10)
        val home = compose.onNodeWithText("home", useUnmergedTree = true).fetchSemanticsNode().boundsInRoot
        val add = compose.onNodeWithText("add", useUnmergedTree = true).fetchSemanticsNode().boundsInRoot
        assertEquals("Trailing uses leading size when omitted", home.width, add.width, 1f)
        compose.runOnIdle { disabled = true }
        compose.mainClock.advanceTimeBy(500)
        val disabledImage = compose.onNodeWithTag("button").captureToImage()
        assertTrue("Custom disabled label retains .38 opacity", disabledImage.count(Color(.62f,.62f,1f)) > 10)
        assertTrue("Custom disabled glyph retains .38 opacity", disabledImage.count(Color(1f,.62f,.62f)) > 10)
        compose.onNode(hasClickAction()).assertIsNotEnabled()
    }

    @Test fun explicitRadiusAndStateLayerPersistWhileToggleStillEmits() {
        val events = mutableListOf<String>()
        compose.setContent { AWCTheme(darkTheme = false) {
            AWCButtonAppearanceScope(AWCButtonAppearance(containerColor = "#FFFFFF", cornerRadius = 0.0,
                stateLayerColor = "#FF0000", pressedOpacity = .5)) {
                AWCButton(AWCButtonProperties(toggle = true, ripple = false), Modifier.testTag("button"),
                    onEvent = { name, _ -> events += name }) { if(it == "") Box(Modifier.size(80.dp, 10.dp)) }
            }
        } }
        compose.mainClock.autoAdvance = false
        val button = compose.onNodeWithTag("button")
        button.performTouchInput { down(center) }
        compose.mainClock.advanceTimeBy(250)
        val pressed = button.captureToImage().toPixelMap()
        val corner = pressed[1,1]
        assertEquals(1f, corner.red, .03f)
        assertEquals(.5f, corner.green, .03f)
        assertEquals(.5f, corner.blue, .03f)
        button.performTouchInput { up() }
        compose.mainClock.advanceTimeBy(600)
        compose.onNode(hasClickAction()).assertIsSelected()
        assertEquals(listOf("mdClick", "mdChange"), events)
        assertEquals(Color.White, button.captureToImage().toPixelMap()[1,1])
    }

    @Test fun appearanceDoesNotInventEmptyIconsOrShrinkMinimumButtonMetrics() {
        var appearance by mutableStateOf(AWCButtonAppearance())
        compose.setContent { AWCTheme {
            AWCButtonAppearanceScope(appearance) {
                AWCButton(modifier = Modifier.testTag("button")) { if(it == "") Box(Modifier.size(80.dp, 10.dp)) }
            }
        } }
        val before = compose.onNodeWithTag("button").fetchSemanticsNode().boundsInRoot
        compose.runOnIdle { appearance = AWCButtonAppearance(iconSize = 100.0, trailingIconSize = 100.0, loadingSize = 100.0) }
        val after = compose.onNodeWithTag("button").fetchSemanticsNode().boundsInRoot
        assertEquals(before.width, after.width, 0f)
        assertEquals(before.height, after.height, 0f)
        compose.runOnIdle { appearance = AWCButtonAppearance(paddingInline = 0.0, paddingBlock = 0.0, fontSize = 8.0, lineHeight = 8.0) }
        val small = compose.onNodeWithTag("button").fetchSemanticsNode().boundsInRoot
        assertTrue(small.height >= 40f * compose.density.density - 1f)
    }

    @Test fun previewParserIgnoresMalformedFieldsWithoutDroppingValidSiblings() {
        val config = JSONObject().put("buttonAppearanceDefaults", JSONObject().put("iconSize", 32).put("labelColor", "#aabbcc"))
            .put("buttonAppearance", JSONObject().put("labelColor", "not a color").put("fontWeight", 600.5).put("gap", 12))
        val resolved = parseLivePreviewButtonAppearance(config, "buttonAppearanceDefaults")
            .merged(parseLivePreviewButtonAppearance(config, "buttonAppearance"))
        assertEquals("#AABBCC", resolved.labelColor)
        assertEquals(32.0, resolved.iconSize)
        assertEquals(12.0, resolved.gap)
        assertNull(resolved.fontWeight)
        assertTrue(parseLivePreviewButtonAppearance(JSONObject().put("buttonAppearance", "bad"), "buttonAppearance").values.isEmpty())
    }

    @Test fun loaderScalesIndependentlyAndCustomStrokeAndContainerRetainDisabledAlpha() {
        var loaderSize by mutableDoubleStateOf(32.0)
        var disabled by mutableStateOf(false)
        compose.mainClock.autoAdvance = false
        compose.setContent { AWCTheme(darkTheme = false) {
            Box(Modifier.background(Color.White).padding(16.dp)) {
                AWCButtonAppearanceScope(AWCButtonAppearance(containerColor = "#0000FF", loadingColor = "#FF00FF",
                    loadingSize = loaderSize, outlineColor = "#FF0000", outlineWidth = 4.0, cornerRadius = 0.0)) {
                    AWCButton(AWCButtonProperties(loading = true, disabled = disabled), Modifier.testTag("button"))
                }
            }
        } }
        compose.mainClock.advanceTimeBy(16)
        val large = compose.onNodeWithTag("button").captureToImage()
        assertTrue("Real native polygon loader uses custom color", large.count(Color.Magenta) > 100)
        val pixel = large.toPixelMap()
        assertEquals(Color.Red, pixel[large.width / 2, 1])
        compose.runOnIdle { loaderSize = 16.0 }
        compose.mainClock.advanceTimeBy(16)
        val small = compose.onNodeWithTag("button").captureToImage()
        assertTrue("Loader size changes actual polygon area", large.count(Color.Magenta) > small.count(Color.Magenta) * 2)
        compose.runOnIdle { disabled = true }
        compose.mainClock.advanceTimeBy(300)
        val faded = compose.onNodeWithTag("button").captureToImage()
        assertTrue("Custom container is .12 blue over white", faded.count(Color(.88f,.88f,1f)) > 100)
        val fadedPixel = faded.toPixelMap()[faded.width / 2, 1]
        // The .12 red border composites over the existing .12 blue container.
        assertEquals(.12f + .88f * .88f, fadedPixel.red, .02f)
        assertEquals(.88f * .88f, fadedPixel.green, .02f)
        assertEquals(.88f, fadedPixel.blue, .02f)
    }

    @Test fun explicitFontSizeAndLineHeightRespectPlatformFontScale() {
        var fontScale by mutableFloatStateOf(1f)
        var expectedLineHeightPx=0f
        compose.setContent { AWCTheme {
            val density = LocalDensity.current.density
            CompositionLocalProvider(LocalDensity provides Density(density, fontScale)) {
                expectedLineHeightPx=with(LocalDensity.current) { 80.sp.toPx() }
                AWCButtonAppearanceScope(AWCButtonAppearance(fontSize = 20.0, lineHeight = 80.0)) {
                    AWCButton(modifier = Modifier.testTag("button")) { if(it == "") Text("Text", Modifier.testTag("label")) }
                }
            }
        } }
        val initial = compose.onNodeWithTag("button").fetchSemanticsNode().boundsInRoot
        val label = compose.onNodeWithTag("label", true).fetchSemanticsNode().boundsInRoot
        assertEquals(80f * compose.density.density, initial.height, 1f)
        compose.runOnIdle { fontScale = 2f }
        val scaled = compose.onNodeWithTag("button").fetchSemanticsNode().boundsInRoot
        val scaledLabel = compose.onNodeWithTag("label", true).fetchSemanticsNode().boundsInRoot
        // Android uses nonlinear accessibility font scaling for larger sp sizes.
        assertEquals("Line box matches the active native sp conversion",expectedLineHeightPx,scaled.height,1f)
        assertTrue("Line box grows with accessibility text scale",scaled.height>initial.height)
        assertTrue("Explicit font size scales actual native text", scaledLabel.width > label.width * 1.5f)
    }

    private fun ImageBitmap.count(target: Color): Int {
        val pixels = toPixelMap()
        var count = 0
        for(y in 0 until height) for(x in 0 until width) {
            val color = pixels[x,y]
            if(abs(color.red-target.red)<.03f && abs(color.green-target.green)<.03f && abs(color.blue-target.blue)<.03f) count++
        }
        return count
    }
}
