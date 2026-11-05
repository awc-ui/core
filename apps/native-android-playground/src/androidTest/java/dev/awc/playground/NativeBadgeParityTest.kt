@file:OptIn(androidx.compose.ui.test.ExperimentalTestApi::class)
package dev.awc.playground

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.*
import androidx.compose.ui.semantics.*
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.*
import androidx.test.platform.app.InstrumentationRegistry
import dev.awc.nativeui.*
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import kotlin.math.abs
import kotlin.math.roundToInt

class NativeBadgeParityTest {
    @get:Rule val compose = createComposeRule()

    @Test fun smallInspectionOmitsUnusedTypographyAndLargeRestoresActualLabelMetrics() {
        val collector=AWCInspectionCollector();var small by mutableStateOf(true)
        compose.setContent { AWCTheme {
            AWCInspectionScope(collector) { AWCComponent("md-badge",mapOf("variant" to if(small) "small" else "large","value" to "7")) }
        } }
        compose.waitForIdle()
        compose.runOnIdle {
            val nodes=collector.snapshot().nodes
            assertNull(nodes.single { it.id=="component" }.metrics?.typography)
            assertFalse(nodes.any { it.id=="component.label" });small=false
        }
        compose.waitForIdle()
        compose.runOnIdle {
            val nodes=collector.snapshot().nodes
            assertNotNull(nodes.single { it.id=="component" }.metrics?.typography)
            assertNotNull(nodes.single { it.id=="component.label" }.metrics?.typography)
        }
    }

    @Test fun all75HydratedWebCasesHaveNativeGeometryAndAuthoredColors() {
        val fixtures = InstrumentationRegistry.getInstrumentation().context.assets.open("BadgeWebGeometry.json")
            .bufferedReader().use { JSONObject(it.readText()).getJSONArray("results") }
        var props by mutableStateOf<Map<String, AWCValue>>(emptyMap())
        var appearance by mutableStateOf(AWCBadgeAppearance())
        var slot by mutableStateOf<String?>(null)
        var rtl by mutableStateOf(false)
        var parentWidth by mutableStateOf(48f)
        var parentHeight by mutableStateOf(48f)
        var epoch by mutableStateOf(0)
        var parentBounds = Rect.Zero
        var badgeBounds = Rect.Zero
        var density = 1f
        val collector = AWCInspectionCollector()
        compose.setContent {
            AWCTheme {
                density = LocalDensity.current.density
                CompositionLocalProvider(LocalLayoutDirection provides if (rtl) LayoutDirection.Rtl else LayoutDirection.Ltr) {
                    Box(Modifier.requiredSize(320.dp, 220.dp).background(Color.White).testTag("canvas"), contentAlignment = Alignment.Center) {
                        key(epoch) {
                            AWCBadgeHost(
                                modifier = Modifier.requiredSize(parentWidth.dp, parentHeight.dp).onGloballyPositioned { parentBounds = it.boundsInRoot() },
                                badge = {
                                    AWCInspectionScope(collector) {
                                        AWCBadgeAppearanceScope(appearance) {
                                            AWCComponent("md-badge", props, Modifier.onGloballyPositioned {
                                                // boundsInRoot collapses zero-height rectangles; the source still
                                                // has a measurable inline size when largeHeight is zero.
                                                badgeBounds = Rect(it.positionInRoot(),androidx.compose.ui.geometry.Size(it.size.width.toFloat(),it.size.height.toFloat()))
                                            }) { name ->
                                                if (name == "icon" && slot != null) {
                                                    repeat(if (slot == "multiple") 2 else 1) { index ->
                                                        if (slot == "symbol") AWCMaterialSymbol("favorite")
                                                        else Text(if (slot == "empty") "" else if (index == 0) "X" else "Y")
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }) { Box(Modifier.fillMaxSize().background(Color.LightGray)) }
                        }
                    }
                }
            }
        }
        val failures = mutableListOf<String>()
        fun expect(id: String, name: String, expected: Double, actual: Double, tolerance: Double = .55) {
            if (abs(actual - expected) > tolerance) failures += "$id $name: native=$actual Web=$expected"
        }
        for (index in 0 until fixtures.length()) {
            val entry = fixtures.getJSONObject(index); val source = entry.getJSONObject("fixture"); val id = source.getString("id")
            val styles = source.optJSONObject("style")
            val values = styles?.keys()?.asSequence()?.associateWith { key ->
                val value = styles.get(key)
                when (key) {
                    "largePadding" -> value.toString().split(" ").map { it.removeSuffix("px").toDouble() }.let { if (it.size == 1) List(4) { _ -> it[0] } else it }
                    "offsetX", "offsetY" -> when (value) {
                        "0%" -> mapOf("points" to 0, "fraction" to 0)
                        "calc(50% + 7px)" -> mapOf("points" to 7, "fraction" to .5)
                        "calc(-50% - 3px)" -> mapOf("points" to -3, "fraction" to -.5)
                        else -> mapOf("points" to value.toString().removeSuffix("px").toDouble(), "fraction" to 0)
                    }
                    else -> value
                }
            } ?: emptyMap()
            compose.runOnIdle {
                props = listOf("variant", "density", "value", "max", "shape", "icon", "hidden").filter { source.has(it) }.associateWith { source.get(it) }
                appearance = AWCBadgeAppearance.fromValues(values); slot = if(source.isNull("slot")) null else source.optString("slot").takeIf { it.isNotEmpty() }
                rtl = source.optString("dir") == "rtl"; parentWidth = source.optDouble("parentWidth", 48.0).toFloat()
                parentHeight = source.optDouble("parentHeight", 48.0).toFloat(); epoch++
            }
            compose.waitForIdle()
            compose.runOnIdle {
                val nodes = collector.snapshot().nodes.associateBy { it.id }
                if (source.optBoolean("hidden")) assertTrue("$id removes inspection", nodes.isEmpty())
                else {
                    val web = entry.getJSONObject("host")
                    val nativeWidth = badgeBounds.width / density
                    val nativeHeight = badgeBounds.height / density
                    val emoji = id == "value-33"
                    if (emoji) {
                        android.util.Log.i("AWCBadgeParity", "$id OS Noto emoji native width=$nativeWidth Web=${web.getDouble("width")}")
                        val labelWidth = nodes["component.label"]?.bounds?.width ?: error("Missing emoji text")
                        expect(id, "emoji intrinsic width with source padding", labelWidth + 8, nativeWidth.toDouble(), .8)
                    } else expect(id, "width", web.getDouble("width"), nativeWidth.toDouble(), 1.05)
                    expect(id, "height", web.getDouble("height"), nativeHeight.toDouble())
                    expect(id, "x", if (emoji) parentWidth - nativeWidth / 2.0 else web.getDouble("x"), ((badgeBounds.left - parentBounds.left) / density).toDouble(), .8)
                    expect(id, "y", web.getDouble("y"), ((badgeBounds.top - parentBounds.top) / density).toDouble())
                    if (nativeWidth > 0 && nativeHeight > 0) {
                        val root = nodes.getValue("component")
                        for (part in listOf("label", "icon")) {
                            val expected = entry.optJSONObject(part)?.takeUnless { it.optString("display").isEmpty() }
                            val actual = nodes["component.$part"]
                            if (expected == null || expected.getDouble("width") == 0.0 || expected.getDouble("height") == 0.0) {
                                if (actual != null) failures += "$id unexpected visible $part"
                            } else if (actual == null) failures += "$id missing $part"
                            else {
                                expect(id, "$part x", expected.getDouble("x"), actual.bounds.x - root.bounds.x, .8)
                                expect(id, "$part y", expected.getDouble("y"), actual.bounds.y - root.bounds.y, .8)
                                if (!(emoji && part == "label")) expect(id, "$part width", expected.getDouble("width"), actual.bounds.width, 1.05)
                                expect(id, "$part height", expected.getDouble("height"), actual.bounds.height, .55)
                            }
                        }
                        val sourceSlots = entry.getJSONArray("slots")
                        val expectedSlots = (0 until sourceSlots.length()).map { sourceSlots.getJSONObject(it) }.filter { it.optString("display").isNotEmpty() }
                        val actualSlots = nodes.values.filter { it.id.startsWith("component.slot-icon") }.sortedBy { it.id }
                        if (expectedSlots.size != actualSlots.size) failures += "$id slot count ${actualSlots.size}/${expectedSlots.size}"
                        actualSlots.forEachIndexed { slotIndex, actual ->
                            val expected = expectedSlots.getOrNull(slotIndex) ?: return@forEachIndexed
                            expect(id, "slot x", expected.getDouble("x"), actual.bounds.x - root.bounds.x, .8)
                            expect(id, "slot y", expected.getDouble("y"), actual.bounds.y - root.bounds.y, .8)
                            expect(id, "slot width", expected.getDouble("width"), actual.bounds.width)
                            expect(id, "slot height", expected.getDouble("height"), actual.bounds.height)
                        }
                    }
                    android.util.Log.i("AWCBadgeParity", "$id width=$nativeWidth height=$nativeHeight x=${(badgeBounds.left-parentBounds.left)/density} y=${(badgeBounds.top-parentBounds.top)/density}")
                }
            }
            if (appearance.containerColor == "#123456") {
                val pixels = compose.onNodeWithTag("canvas").captureToImage().toPixelMap()
                var hits = 0
                for (y in 0 until pixels.height) for (x in 0 until pixels.width) {
                    val pixel = pixels[x, y]
                    if (abs(pixel.red - 18 / 255f) < .025 && abs(pixel.green - 52 / 255f) < .025 && abs(pixel.blue - 86 / 255f) < .025) hits++
                }
                assertTrue("$id actual authored background color", hits > 20)
            }
        }
        assertTrue(failures.joinToString("\n"), failures.isEmpty())
    }

    // Gate-7 R2-D1: fresh default-palette Chrome capture (font-only stylesheet, unmodified library tokens), light and dark.
    // No colours are injected: container, label and icon ink must equal Chrome's for every unstyled case.
    @Test fun allDefaultPaletteCasesPaintLibraryContainerAndInkLightAndDark() {
        var props by mutableStateOf<Map<String, AWCValue>>(emptyMap())
        var slot by mutableStateOf<String?>(null)
        var dark by mutableStateOf(false)
        var rtl by mutableStateOf(false)
        var parentWidth by mutableStateOf(48f)
        var parentHeight by mutableStateOf(48f)
        var epoch by mutableStateOf(0)
        var canvasOrigin = androidx.compose.ui.geometry.Offset.Zero
        var badgeOrigin = androidx.compose.ui.geometry.Offset.Zero
        var density = 1f
        val collector = AWCInspectionCollector()
        compose.setContent {
            AWCTheme(darkTheme = dark) {
                density = LocalDensity.current.density
                CompositionLocalProvider(LocalLayoutDirection provides if (rtl) LayoutDirection.Rtl else LayoutDirection.Ltr) {
                    Box(Modifier.requiredSize(320.dp, 220.dp).background(Color.White).testTag("canvas").onGloballyPositioned { canvasOrigin = it.positionInRoot() }, contentAlignment = Alignment.Center) {
                        key(epoch) {
                            AWCBadgeHost(modifier = Modifier.requiredSize(parentWidth.dp, parentHeight.dp), badge = {
                                AWCInspectionScope(collector) {
                                    AWCComponent("md-badge", props, Modifier.onGloballyPositioned { badgeOrigin = it.positionInRoot() }) { name ->
                                        if (name == "icon" && slot != null) {
                                            repeat(if (slot == "multiple") 2 else 1) { index ->
                                                if (slot == "symbol") AWCMaterialSymbol("favorite")
                                                else Text(if (slot == "empty") "" else if (index == 0) "X" else "Y")
                                            }
                                        }
                                    }
                                }
                            }) { Box(Modifier.fillMaxSize().background(Color.LightGray)) }
                        }
                    }
                }
            }
        }
        val failures = mutableListOf<String>(); var checked = 0
        fun rgb(css: String) = Regex("-?(?:\\d*\\.)?\\d+").findAll(css).map { it.value.toDouble() }.take(3).toList()
        for (theme in listOf("light", "dark")) {
            val results = InstrumentationRegistry.getInstrumentation().context.assets.open("BadgeDefaultWeb-$theme.json")
                .bufferedReader().use { JSONObject(it.readText()).getJSONArray("results") }
            for (index in 0 until results.length()) {
                val entry = results.getJSONObject(index); val source = entry.getJSONObject("fixture"); val id = "default-$theme/${source.getString("id")}"
                if (source.has("style") || source.optBoolean("hidden") || source.getString("id") == "value-33") continue
                compose.runOnIdle {
                    props = listOf("variant", "density", "value", "max", "shape", "icon").filter { source.has(it) }.associateWith { source.get(it) }
                    slot = if (!source.has("slot") || source.isNull("slot")) null else source.optString("slot").takeIf { it.isNotEmpty() }
                    dark = theme == "dark"; rtl = source.optString("dir") == "rtl"
                    parentWidth = source.optDouble("parentWidth", 48.0).toFloat(); parentHeight = source.optDouble("parentHeight", 48.0).toFloat(); epoch++
                }
                compose.waitForIdle()
                val nodes = compose.runOnIdle { collector.snapshot().nodes.associateBy { it.id } }
                val pixels = compose.onNodeWithTag("canvas").captureToImage().toPixelMap()
                fun hits(c: List<Double>, tolerance: Double, box: AWCInspectionBounds? = null): Int {
                    val root = nodes["component"]?.bounds
                    val x0 = if (box == null || root == null) 0 else ((badgeOrigin.x - canvasOrigin.x) + (box.x - root.x).toFloat() * density).roundToInt()
                    val y0 = if (box == null || root == null) 0 else ((badgeOrigin.y - canvasOrigin.y) + (box.y - root.y).toFloat() * density).roundToInt()
                    val x1 = if (box == null) pixels.width else x0 + (box.width.toFloat() * density).roundToInt()
                    val y1 = if (box == null) pixels.height else y0 + (box.height.toFloat() * density).roundToInt()
                    var n = 0
                    for (y in maxOf(0, y0) until minOf(pixels.height, y1)) for (x in maxOf(0, x0) until minOf(pixels.width, x1)) {
                        val p = pixels[x, y]
                        if (abs(p.red * 255 - c[0]) <= tolerance && abs(p.green * 255 - c[1]) <= tolerance && abs(p.blue * 255 - c[2]) <= tolerance) n++
                    }
                    return n
                }
                val host = entry.getJSONObject("host")
                if (hits(rgb(host.getString("background")), 3.0) <= 8) failures += "$id container ${host.getString("background")}"
                // Ink only inside the measured part box (inside the container): a white label cannot match the white page.
                val hasText = source.optString("value").isNotBlank()
                for (part in listOf("label", "icon")) {
                    if (part == "label" && !hasText) continue
                    val p = entry.optJSONObject(part) ?: continue
                    val box = nodes["component.$part"]?.bounds ?: continue
                    if (p.optString("display") == "block" && p.optString("color").isNotEmpty() && box.width > 0 && hits(rgb(p.getString("color")), 8.0, box) <= 2)
                        failures += "$id $part ink ${p.getString("color")} in $box"
                }
                checked++
            }
        }
        android.util.Log.i("AWCBadgeParity", "default palette cases $checked")
        assertTrue(failures.joinToString("\n"), failures.isEmpty())
        assertTrue("default palette cases compared: $checked", checked > 100)
    }

    @Test fun iconButtonDensityIsInheritedUnlessBadgeSuppliesANegativeLocalRung() {
        val collector=AWCInspectionCollector()
        var parentDensity by mutableStateOf(-4)
        var localDensity by mutableStateOf<Int?>(null)
        var physicalScale=1f
        compose.setContent { AWCTheme {
            physicalScale=LocalDensity.current.density
            AWCComponent("md-icon-button",mapOf("size" to "md","density" to parentDensity,"icon" to "notifications")) { slot->
                if(slot.isEmpty()) AWCInspectionScope(collector) {
                    AWCComponent("md-badge",buildMap {
                        put("value","8");put("icon","error")
                        localDensity?.let { put("density",it) }
                    })
                }
            }
        } }
        for(parent in listOf(-4,-2)) for(local in listOf(null,0,-1,-4)) {
            compose.runOnIdle { parentDensity=parent;localDensity=local };compose.waitForIdle()
            compose.runOnIdle {
                val rung=if(local!=null && local<0) local else parent
                val nodes=collector.snapshot().nodes.associateBy { it.id };val root=nodes.getValue("component")
                assertEquals("parent=$parent local=$local",16.0+rung,root.bounds.height,.55)
                assertEquals(10.0+rung*.5,nodes.getValue("component.icon").bounds.width,.55)
                assertEquals(11.0+rung*.5,root.metrics!!.typography!!.size,.01)
                val expectedPadding=((4.0+rung*.5)*physicalScale).roundToInt()/physicalScale.toDouble()
                assertEquals(expectedPadding,root.metrics!!.padding!!.left,.01)
            }
        }
    }

    @Test fun inspectionUsesAppliedPhysicalPaddingAndKeepsUnchangedSnapshotIdentity() {
        val collector=AWCInspectionCollector()
        var padding by mutableStateOf(AWCBadgePadding(1.23,2.34,3.45,4.56))
        var scale=1f
        compose.setContent { AWCTheme {
            scale=LocalDensity.current.density
            AWCBadgeHost(Modifier.requiredSize(48.dp),badge={
                AWCInspectionScope(collector) {
                    AWCBadgeAppearanceScope(AWCBadgeAppearance(largePadding=padding)) {
                        AWCComponent("md-badge",mapOf("value" to "8"))
                    }
                }
            }) { Box(Modifier.fillMaxSize()) }
        } }
        for(next in listOf(AWCBadgePadding(1.23,2.34,3.45,4.56),AWCBadgePadding(left=20000.0))) {
            compose.runOnIdle { padding=next };compose.waitForIdle()
            compose.runOnIdle {
                val snapshot=collector.snapshot();val actual=snapshot.nodes.first { it.id=="component" }.metrics!!.padding!!
                listOf(next.top,next.right,next.bottom,next.left).zip(listOf(actual.top,actual.right,actual.bottom,actual.left)).forEach { (requested,measured)->
                    assertEquals((requested*scale).coerceIn(0.0,32766.0).roundToInt()/scale.toDouble(),measured,.0001)
                }
                assertSame("Unchanged inspection must correlate to a committed capture",snapshot,collector.snapshot())
            }
        }
    }

    @Test fun statusIsPoliteAndUpdatesWhileParentKeepsItsSizeAndAction() {
        var value by mutableStateOf("8")
        var clicks = 0
        compose.setContent {
            AWCTheme {
                AWCBadgeHost(badge = { AWCComponent("md-badge", mapOf("value" to value)) }) {
                    AWCComponent("md-icon-button", mapOf("size" to "md", "icon" to "notifications", "aria-label" to "Notifications"),
                        onEvent = { name, _ -> if (name == "mdClick") clicks++ })
                }
            }
        }
        compose.onNodeWithContentDescription("8").assert(SemanticsMatcher.expectValue(SemanticsProperties.LiveRegion, LiveRegionMode.Polite))
        compose.onNodeWithContentDescription("Notifications").performClick()
        compose.runOnIdle { assertEquals(1, clicks); value = "1200" }
        compose.onNodeWithContentDescription("999+").assertExists()
        compose.onNodeWithContentDescription("8").assertDoesNotExist()
    }
}
