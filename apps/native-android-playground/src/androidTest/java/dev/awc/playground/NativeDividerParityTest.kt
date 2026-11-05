package dev.awc.playground

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.LocalTextStyle
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.*
import androidx.test.platform.app.InstrumentationRegistry
import dev.awc.nativeui.*
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

class NativeDividerParityTest {
    @get:Rule val compose = createComposeRule()

    @Test fun inspectionReportsAppliedPhysicalMarginsIncludingCoordinateLimit() {
        var inset by mutableStateOf(12.23)
        val collector = AWCInspectionCollector()
        compose.setContent {
            AWCTheme {
                Box(Modifier.width(240.dp).height(96.dp)) {
                    AWCInspectionScope(collector) {
                        AWCDividerAppearanceScope(AWCDividerAppearance(insetStart = inset)) {
                            AWCComponent("md-divider", mapOf("insetStart" to true))
                        }
                    }
                }
            }
        }
        fun verify() = compose.runOnIdle {
            val nodes = collector.snapshot().nodes
            val root = nodes.first { it.id == "component" }
            val line = nodes.first { it.id == "component.divider" }
            assertEquals("Reported margin is actual positioned offset",
                line.bounds.x - root.bounds.x, line.metrics!!.margin!!.left, .01)
        }
        verify()
        compose.runOnIdle { inset = -20000.0 }
        verify()
    }

    @Test fun actualNativeGeometryMatchesEveryWebFixture() {
        val json = InstrumentationRegistry.getInstrumentation().context.assets.open("DividerWebGeometry.json")
            .bufferedReader().use { JSONObject(it.readText()) }
        val fixtures = json.getJSONArray("results")
        var properties by mutableStateOf<Map<String, AWCValue>>(emptyMap())
        var appearance by mutableStateOf(AWCDividerAppearance())
        var rtl by mutableStateOf(false)
        var height by mutableStateOf(96f)
        var epoch by mutableStateOf(0)
        val collector = AWCInspectionCollector()
        compose.setContent {
            AWCTheme {
                CompositionLocalProvider(LocalLayoutDirection provides if (rtl) LayoutDirection.Rtl else LayoutDirection.Ltr,
                    LocalTextStyle provides TextStyle(fontSize = 16.sp)) {
                    Box(Modifier.width(320.dp).height(220.dp).background(Color.White).testTag("canvas")) {
                        Box(Modifier.padding(32.dp).width(240.dp).height(height.dp)) {
                            key(epoch) {
                                AWCInspectionScope(collector) {
                                    AWCDividerAppearanceScope(appearance) { AWCComponent("md-divider", properties) }
                                }
                            }
                        }
                    }
                }
            }
        }
        for (index in 0 until fixtures.length()) {
            val entry = fixtures.getJSONObject(index)
            val fixture = entry.getJSONObject("fixture")
            val id = fixture.getString("id")
            val props = listOf("vertical", "inset", "insetStart", "insetEnd", "hidden")
                .filter { fixture.has(it) }.associateWith { fixture.getBoolean(it) }
            val styles = fixture.optJSONObject("style")
            val values = styles?.keys()?.asSequence()?.associateWith { styles.get(it) } ?: emptyMap()
            compose.runOnIdle {
                properties = props
                appearance = AWCDividerAppearance.fromValues(values)
                rtl = fixture.optString("dir") == "rtl"
                height = fixture.optDouble("height", 96.0).toFloat()
                epoch++
            }
            compose.waitForIdle()
            compose.runOnIdle {
                val nodes = collector.snapshot().nodes
                if (fixture.optBoolean("hidden")) {
                    assertTrue("$id hidden removes inspection tree", nodes.isEmpty())
                } else {
                    val webHost = entry.getJSONObject("host")
                    val webLine = entry.getJSONObject("line")
                    val root = nodes.firstOrNull { it.id == "component" }
                    val line = nodes.firstOrNull { it.id == "component.divider" }
                    // The inspection protocol intentionally omits zero-area nodes.
                    if (webHost.getDouble("width") == 0.0 || webHost.getDouble("height") == 0.0) {
                        assertNull("$id empty root omitted", root)
                    } else {
                        assertNotNull("$id root measured", root)
                        assertEquals("$id host width", webHost.getDouble("width"), root!!.bounds.width, .55)
                        assertEquals("$id host height", webHost.getDouble("height"), root.bounds.height, .55)
                        if (webLine.getDouble("width") == 0.0 || webLine.getDouble("height") == 0.0) {
                            assertNull("$id empty painted part omitted", line)
                        } else {
                            assertNotNull("$id painted part measured", line)
                            assertEquals("$id line x", webLine.getDouble("x"), line!!.bounds.x - root.bounds.x, .55)
                            assertEquals("$id line y", webLine.getDouble("y"), line.bounds.y - root.bounds.y, .55)
                            assertEquals("$id line width", webLine.getDouble("width"), line.bounds.width, .55)
                            assertEquals("$id line height", webLine.getDouble("height"), line.bounds.height, .55)
                        }
                    }
                }
            }
            if (appearance.color == "#123456") {
                val pixels = compose.onNodeWithTag("canvas").captureToImage().toPixelMap()
                var hits = 0
                for (y in 0 until pixels.height) for (x in 0 until pixels.width) {
                    val pixel = pixels[x, y]
                    if (kotlin.math.abs(pixel.red - 18/255f) < .025 &&
                        kotlin.math.abs(pixel.green - 52/255f) < .025 &&
                        kotlin.math.abs(pixel.blue - 86/255f) < .025) hits++
                }
                assertTrue("$id authored color appears in actual rendered pixels", hits > 20)
            }
        }
    }
}
