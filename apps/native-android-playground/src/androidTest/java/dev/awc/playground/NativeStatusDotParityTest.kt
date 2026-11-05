@file:OptIn(androidx.compose.ui.test.ExperimentalTestApi::class)
package dev.awc.playground

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.layout.*
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
import kotlin.math.*

class NativeStatusDotParityTest {
    @get:Rule val compose = createComposeRule()

    private fun document(theme: String, prefix: String = "StatusDotWeb") = InstrumentationRegistry.getInstrumentation().context.assets
        .open("$prefix-$theme.json").bufferedReader().use { JSONObject(it.readText()) }

    private fun appearance(source: JSONObject): AWCStatusDotAppearance {
        val style = source.optJSONObject("style") ?: return AWCStatusDotAppearance()
        fun length(key: String) = style.optString(key).removeSuffix("px").toDoubleOrNull()
        fun inset(key: String): AWCStatusDotInset? {
            if (!style.has(key)) return null
            val text = style.getString(key)
            if (text.startsWith("calc(")) {
                val parts = text.removePrefix("calc(").removeSuffix(")").split(" ")
                return AWCStatusDotInset(parts[2].removeSuffix("px").toDouble() * if(parts[1] == "-") -1 else 1,
                    parts[0].removeSuffix("%").toDouble() / 100)
            }
            return if (text.endsWith("%")) AWCStatusDotInset(fraction = text.dropLast(1).toDouble() / 100)
                else AWCStatusDotInset(points = text.removeSuffix("px").toDouble())
        }
        return AWCStatusDotAppearance(length("size"), style.optString("color").takeIf { it.isNotEmpty() },
            style.optString("pulseColor").takeIf { it.isNotEmpty() }, style.optString("outlineColor").takeIf { it.isNotEmpty() },
            length("outlineWidth"), inset("insetEnd"), inset("insetBlockEnd"),
            style.optString("pulseDuration").removeSuffix("s").toDoubleOrNull())
    }

    @Test fun all200WebCasesMatchNativePlacementThemesDensityAndActualFill() = runSourceMatrix("StatusDotWeb", true)
    // Gate-7 R2-D1/R2-D5: fresh default-palette Chrome capture; no colours are injected into the native theme.
    @Test fun all200PristineDefaultPaletteCasesMatchWithoutTokenInjection() = runSourceMatrix("StatusDotDefaultWeb", false)
    private fun runSourceMatrix(prefix: String, injectTokens: Boolean) {
        var props by mutableStateOf<Map<String, AWCValue>>(emptyMap())
        var appearance by mutableStateOf(AWCStatusDotAppearance())
        var dark by mutableStateOf(false)
        var tokens by mutableStateOf<Map<String, String>>(emptyMap())
        var rtl by mutableStateOf(false)
        var inheritedDensity by mutableStateOf(0.0)
        var parentWidth by mutableStateOf(48f)
        var parentHeight by mutableStateOf(48f)
        var epoch by mutableStateOf(0)
        var parentBounds = Rect.Zero
        var dotBounds = Rect.Zero
        var canvasBounds = Rect.Zero
        val collector = AWCInspectionCollector()
        compose.setContent {
            CompositionLocalProvider(LocalDensity provides Density(2f, 1f),
                LocalLayoutDirection provides if (rtl) LayoutDirection.Rtl else LayoutDirection.Ltr) {
                AWCTheme(dark, tokens) {
                    AWCDensityScope(inheritedDensity) {
                        Box(Modifier.requiredSize(320.dp, 220.dp).background(Color.White).testTag("canvas")
                            .onGloballyPositioned { canvasBounds = it.boundsInRoot() }, contentAlignment = Alignment.Center) {
                            key(epoch) {
                                val dot: @Composable () -> Unit = {
                                    AWCInspectionScope(collector) {
                                        AWCStatusDotAppearanceScope(appearance) {
                                            AWCComponent("md-status-dot", props, Modifier.onGloballyPositioned {
                                                dotBounds = Rect(it.positionInRoot(), Size(it.size.width.toFloat(), it.size.height.toFloat()))
                                            })
                                        }
                                    }
                                }
                                val parentModifier = Modifier.requiredSize(parentWidth.dp, parentHeight.dp)
                                    .onGloballyPositioned { parentBounds = it.boundsInRoot() }
                                if (props["inline"] == true) Box(parentModifier, contentAlignment = Alignment.Center) { dot() }
                                else AWCStatusDotHost(parentModifier, dot = dot) { Box(Modifier.fillMaxSize()) }
                            }
                        }
                    }
                }
            }
        }
        val failures = mutableListOf<String>()
        fun expect(id: String, name: String, expected: Double, actual: Double, tolerance: Double = .3) {
            if (abs(expected - actual) > tolerance) failures += "$id $name: native=$actual Web=$expected"
        }
        for (theme in listOf("light", "dark")) {
            val document = document(theme, prefix); val sourceTokens = document.getJSONObject("tokens")
            val fixtures = document.getJSONArray("results")
            val colors = sourceTokens.keys().asSequence().filter { it in AWCThemeColorRoles }.associateWith { key ->
                val raw = sourceTokens.getString(key)
                if (raw.length == 4) "#" + raw.drop(1).map { "$it$it" }.joinToString("") else raw
            }
            for (index in 0 until fixtures.length()) {
                val entry = fixtures.getJSONObject(index); val source = entry.getJSONObject("fixture")
                val web = entry.getJSONObject("host"); val id = "$theme/${source.getString("id")}"
                compose.runOnIdle {
                    props = listOf("state", "size", "inline", "shape", "live", "label", "density", "hidden", "dir")
                        .filter { source.has(it) }.associateWith { source.get(it) }
                    appearance = appearance(source); dark = theme == "dark"; tokens = if (injectTokens) colors else emptyMap()
                    rtl = source.optString("dir") == "rtl"; inheritedDensity = source.optDouble("inheritedDensity", 0.0)
                    parentWidth = source.optDouble("parentWidth", 48.0).toFloat()
                    parentHeight = source.optDouble("parentHeight", 48.0).toFloat()
                    epoch++
                }
                compose.waitForIdle()
                if (source.optBoolean("hidden")) {
                    compose.runOnIdle { assertTrue("$id hidden has no inspection", collector.snapshot().nodes.isEmpty()) }
                    continue
                }
                compose.runOnIdle {
                    expect(id, "width", web.getDouble("width"), dotBounds.width / 2.0)
                    expect(id, "height", web.getDouble("height"), dotBounds.height / 2.0)
                    expect(id, "x", web.getDouble("x"), (dotBounds.left - parentBounds.left) / 2.0)
                    expect(id, "y", web.getDouble("y"), (dotBounds.top - parentBounds.top) / 2.0)
                    val root = collector.snapshot().nodes.singleOrNull { it.id == "component" }
                    assertNotNull("$id actual inspection, including zero size", root)
                    expect(id, "inspector width", dotBounds.width / 2.0, root!!.bounds.width, .001)
                    expect(id, "inspector x", dotBounds.left / 2.0, root.bounds.x, .001)
                }
                if (web.getDouble("width") >= 4 && source.optString("state") != "invisible") {
                    val image = compose.onNodeWithTag("canvas").captureToImage().toPixelMap()
                    val x = (dotBounds.center.x - canvasBounds.left).roundToInt().coerceIn(0, image.width - 1)
                    val y = (dotBounds.center.y - canvasBounds.top).roundToInt().coerceIn(0, image.height - 1)
                    val actual = image[x, y]
                    val values = Regex("-?(?:\\d*\\.)?\\d+").findAll(web.getString("fill")).map { it.value.toDouble() }.toList()
                    val alpha = values.getOrElse(3) { 1.0 }
                    for ((channel, actualValue) in listOf(actual.red, actual.green, actual.blue).withIndex())
                        expect(id, "fill channel $channel", (values[channel] * alpha + 255 * (1 - alpha)) / 255,
                            actualValue.toDouble(), .016)
                }
            }
        }
        assertTrue(failures.joinToString("\n"), failures.isEmpty())
    }

    @Test fun labelsStayAccessibilityOnlyAndLiveStatusIsPolite() {
        var props by mutableStateOf<Map<String, AWCValue>>(mapOf("inline" to true, "label" to "Available"))
        compose.setContent { AWCTheme { AWCComponent("md-status-dot", props) } }
        compose.onNodeWithContentDescription("Available").assert(SemanticsMatcher.expectValue(SemanticsProperties.Role, Role.Image))
        compose.onAllNodes(hasText("Available")).assertCountEquals(0)
        compose.runOnIdle { props = props + ("live" to true) + ("label" to "Busy") }
        compose.onNodeWithContentDescription("Busy").assert(SemanticsMatcher.expectValue(SemanticsProperties.LiveRegion, LiveRegionMode.Polite))
        compose.runOnIdle { props = props + ("label" to "\uFEFF\u00A0") }
        compose.onAllNodes(hasContentDescription("\uFEFF\u00A0")).assertCountEquals(0)
        compose.runOnIdle { props = props + ("hidden" to true) + ("label" to "Hidden") }
        compose.onAllNodes(hasContentDescription("Hidden")).assertCountEquals(0)
    }

    @Test fun activePulseLeavesAlphaFillUntintedAndStopsAtZeroDuration() {
        var duration by mutableStateOf(2.0)
        compose.mainClock.autoAdvance = false
        compose.setContent {
            AWCTheme {
                Box(Modifier.requiredSize(140.dp).background(Color.White).testTag("pulse"), contentAlignment = Alignment.Center) {
                    AWCStatusDotAppearanceScope(AWCStatusDotAppearance(size = 80.0, color = "#FF000080",
                        pulseColor = "#00FF00", outlineWidth = 0.0, pulseDuration = duration)) {
                        AWCComponent("md-status-dot", mapOf("inline" to true, "state" to "online", "live" to true))
                    }
                }
            }
        }
        compose.mainClock.advanceTimeBy(700)
        val first = compose.onNodeWithTag("pulse").captureToImage().toPixelMap()
        val center = first[first.width / 2, first.height / 2]
        assertEquals(1f, center.red, .01f); assertEquals(127f / 255, center.green, .01f)
        fun greenPixels(image: androidx.compose.ui.graphics.PixelMap): Int {
            var count = 0
            for (y in 0 until image.height) for (x in 0 until image.width) {
                val pixel = image[x, y]
                if (pixel.green > .95f && pixel.red < .95f && pixel.blue < .95f) count++
            }
            return count
        }
        assertTrue("Real exterior pulse", greenPixels(first) > 8)
        compose.runOnUiThread { duration = 0.0 }
        compose.mainClock.advanceTimeBy(32)
        val stopped = compose.onNodeWithTag("pulse").captureToImage().toPixelMap()
        assertEquals("Zero duration cancels halo", 0, greenPixels(stopped))
    }
}
