package dev.awc.playground

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import dev.awc.nativeui.*
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

class NativeButtonInspectionTest {
    @get:Rule val compose = createComposeRule()

    private fun snapshot(collector: AWCInspectionCollector): AWCInspectionSnapshot {
        lateinit var result: AWCInspectionSnapshot
        compose.runOnIdle { result = collector.snapshot() }
        return result
    }

    @Test fun measuredPartsAndAppliedOverridesMatchNativeLayoutInBothDirections() {
        val collector = AWCInspectionCollector()
        var rtl by mutableStateOf(false)
        val appearance = AWCButtonAppearance(iconSize = 24.0, trailingIconSize = 32.0, fontSize = 22.0,
            fontWeight = 700.0, lineHeight = 30.0, letterSpacing = 1.5, outlineWidth = 4.0,
            paddingInline = 24.0, paddingBlock = 10.0, gap = 12.0)
        compose.setContent {
            CompositionLocalProvider(LocalDensity provides Density(2f, 1.5f),
                LocalLayoutDirection provides if (rtl) LayoutDirection.Rtl else LayoutDirection.Ltr) {
                AWCTheme {
                    Box(Modifier.padding(16.dp)) {
                        AWCInspectionScope(collector) {
                            AWCButtonAppearanceScope(appearance) {
                                AWCComponent("md-button", mapOf("label" to "Continue", "icon" to "home",
                                    "trailingIcon" to "add", "ripple" to false), modifier = Modifier.testTag("button"))
                            }
                        }
                    }
                }
            }
        }
        for (direction in listOf(false, true)) {
            compose.runOnIdle { rtl = direction }
            compose.waitForIdle()
            val nodes = snapshot(collector).nodes.associateBy { it.id }
            val root = nodes.getValue("component")
            val content = nodes.getValue("component.content")
            val label = nodes.getValue("component.content.label")
            val text = nodes.getValue("component.content.label.text")
            val leading = nodes.getValue("component.content.leading-icon")
            val trailing = nodes.getValue("component.content.trailing-icon")
            val measured = compose.onNodeWithTag("button", true).fetchSemanticsNode().boundsInRoot
            assertEquals(measured.left / 2.0, root.bounds.x, 0.01)
            assertEquals(measured.top / 2.0, root.bounds.y, 0.01)
            assertEquals(measured.width / 2.0, root.bounds.width, 0.01)
            assertEquals(measured.height / 2.0, root.bounds.height, 0.01)
            assertEquals(AWCInspectionInsets(14.0, 24.0, 14.0, 24.0), root.metrics!!.padding)
            assertEquals(AWCInspectionInsets(), root.metrics!!.margin)
            assertEquals(AWCInspectionInsets(4.0, 4.0, 4.0, 4.0), root.metrics!!.border)
            assertEquals(AWCInspectionGap(0.0, 12.0), root.metrics!!.gap)
            assertEquals(if (rtl) "rtl" else "ltr", root.metrics!!.direction)
            assertEquals("component", content.parentId)
            for (part in listOf(label, leading, trailing)) assertEquals("component.content", part.parentId)
            assertEquals("component.content.label", text.parentId)
            assertEquals(AWCInspectionGap(0.0, 12.0), content.metrics!!.gap)
            assertEquals(24.0, leading.bounds.width, 0.01)
            assertEquals(32.0, trailing.bounds.width, 0.01)
            assertEquals(12.0, if (rtl) leading.bounds.x - label.bounds.x - label.bounds.width
                else label.bounds.x - leading.bounds.x - leading.bounds.width, 0.5)
            assertEquals(24.0, content.bounds.x - root.bounds.x, 0.5)
            // Values come from TextLayoutResult in sp, not density/fontScale-converted guesses.
            assertEquals(AWCInspectionTypography(22.0, 30.0, 700, 1.5, "Roboto"), text.metrics!!.typography)
            val measuredText = compose.onNodeWithText("Continue", useUnmergedTree = true).fetchSemanticsNode().boundsInRoot
            assertEquals("Text bounds use actual native layout", measuredText.height / 2.0, text.bounds.height, 0.01)
            assertEquals(if (rtl) "rtl" else "ltr", text.metrics!!.direction)
            val serialized = serializeLivePreviewInspection(snapshot(collector)).getJSONArray("nodes")
            val serializedText = (0 until serialized.length()).map { serialized.getJSONObject(it) }.single { it.getString("id") == text.id }
            assertEquals("sp", serializedText.getJSONObject("metrics").getJSONObject("typography").getString("unit"))
        }
    }

    @Test fun unchangedRecompositionPreservesSnapshotAndRemovedPartsDoNotLinger() {
        compose.mainClock.autoAdvance = false
        val collector = AWCInspectionCollector()
        var color by mutableStateOf("#FFFFFF")
        var icons by mutableStateOf(true)
        var shown by mutableStateOf(true)
        compose.setContent {
            AWCTheme {
                if (shown) AWCInspectionScope(collector) {
                    AWCButtonAppearanceScope(AWCButtonAppearance(containerColor = color)) {
                        AWCComponent("md-button", mapOf("label" to "Continue", "icon" to if (icons) "home" else "",
                            "trailingIcon" to if (icons) "add" else "", "loading" to icons, "ripple" to false))
                    }
                }
            }
        }
        compose.mainClock.advanceTimeBy(32)
        compose.waitForIdle()
        val initial = snapshot(collector)
        assertTrue(initial.nodes.any { it.id == "component.content.loader" })
        compose.runOnIdle { color = "#000000" }
        compose.mainClock.advanceTimeBy(1000)
        compose.waitForIdle()
        assertSame("Color-only recomposition must not invalidate frame geometry", initial, snapshot(collector))
        compose.runOnIdle { icons = false }
        compose.mainClock.advanceTimeBy(32)
        compose.waitForIdle()
        val withoutIcons = snapshot(collector)
        assertFalse("Removed parts must not retain bounds: ${withoutIcons.nodes.map { it.id }}",
            withoutIcons.nodes.any { it.id.contains("icon") || it.id.endsWith(".loader") })
        assertTrue(withoutIcons.nodes.any { it.id == "component.content.label.text" })
        compose.runOnIdle { shown = false }
        compose.mainClock.advanceTimeBy(32)
        compose.waitForIdle()
        assertTrue("Unmounting removes evidence from the collector", snapshot(collector).nodes.isEmpty())
    }

    @Test fun registrySlotsCannotExportOrphanTextAndNestedComponentsKeepTheirOwnRoot() {
        val collector = AWCInspectionCollector()
        var button by mutableStateOf(true)
        compose.setContent {
            AWCTheme {
                AWCInspectionScope(collector) {
                    if (button) {
                        AWCSlotsScope(AWCSlotRegistry(mapOf("" to {
                            val text = rememberAWCInspectionText("content.label.text", family = "Roboto")
                            Text("Registry label", modifier = text.modifier, onTextLayout = text.onTextLayout)
                        }))) {
                            AWCComponent("md-button", mapOf("label" to "Fallback", "ripple" to false))
                        }
                    } else {
                        AWCComponent("md-card") {
                            if (it.isEmpty()) AWCComponent("md-button", mapOf("label" to "Nested", "ripple" to false))
                        }
                    }
                }
            }
        }
        compose.waitForIdle()
        val nodes = snapshot(collector).nodes
        assertEquals("md-button", nodes.single { it.id == "component" }.name)
        assertEquals("Registered text retains a measured label parent",
            "component.content.label", nodes.single { it.id=="component.content.label.text" }.parentId)
        assertTrue(nodes.all { node -> node.parentId == null || nodes.any { it.id == node.parentId } })
        compose.runOnIdle { button = false }
        compose.waitForIdle()
        assertEquals("Other component types retain their measured root without nested ID reuse",
            listOf("md-card"), snapshot(collector).nodes.map { it.name })
    }

    @Test fun mirroredAndAnimatedGlyphBoundsStayInRootCoordinates() {
        compose.mainClock.autoAdvance = false
        val collector = AWCInspectionCollector()
        var expanded by mutableStateOf(false)
        var rtl by mutableStateOf(false)
        compose.setContent {
            CompositionLocalProvider(LocalDensity provides Density(2f),
                LocalLayoutDirection provides if (rtl) LayoutDirection.Rtl else LayoutDirection.Ltr) {
                AWCTheme {
                    AWCInspectionScope(collector) {
                        AWCComponent("md-button", mapOf("label" to "Continue", "icon" to "home",
                            "trailingIcon" to "add", "mirrorIcon" to true, "aria-expanded" to expanded, "ripple" to false))
                    }
                }
            }
        }
        fun assertGlyphsMatchNativeBounds() {
            val nodes = snapshot(collector).nodes.associateBy { it.id }
            for ((glyph, part) in listOf("home" to "leading-icon", "add" to "trailing-icon")) {
                val actual = compose.onNodeWithText(glyph, useUnmergedTree = true).fetchSemanticsNode().boundsInRoot
                val reported = nodes.getValue("component.content.$part.text").bounds
                assertEquals("$glyph left", actual.left / 2.0, reported.x, 0.05)
                assertEquals("$glyph top", actual.top / 2.0, reported.y, 0.05)
                assertEquals("$glyph width", actual.width / 2.0, reported.width, 0.05)
                assertEquals("$glyph height", actual.height / 2.0, reported.height, 0.05)
            }
        }
        compose.mainClock.advanceTimeBy(32)
        assertGlyphsMatchNativeBounds()
        compose.runOnIdle { expanded = true }
        // Sample during rotation, when a transformed rectangle differs from
        // its layout size, and again at its 180-degree endpoint.
        compose.mainClock.advanceTimeBy(48)
        assertGlyphsMatchNativeBounds()
        compose.mainClock.advanceTimeBy(128)
        assertGlyphsMatchNativeBounds()
        compose.runOnIdle { rtl = true }
        compose.mainClock.advanceTimeBy(128)
        assertGlyphsMatchNativeBounds()
    }
}
