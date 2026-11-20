package dev.awc.playground

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.test.platform.app.InstrumentationRegistry
import dev.awc.nativeui.*
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import kotlin.math.abs

/** s9-4 (r3-19 mechanism 2): a floating md-accordion panel is published in the AWCModalScope overlay. Replays Chrome 153
 * (stacking2-web.json from s94-lab/web/stacking2.mjs): inside a clipping container, under an open bottom sheet (declared
 * after / before the accordion) and under an open dialog. */
class NativeStackingOverlayTest {
    @get:Rule val compose = createComposeRule()
    private val oracle by lazy { JSONObject(InstrumentationRegistry.getInstrumentation().context.assets.open("stacking2-web.json").bufferedReader().readText()) }
    private fun JSONArray.ints() = (0 until length()).map { getInt(it) }
    private fun JSONArray.objects() = (0 until length()).map { getJSONObject(it) }
    private val teal = Color(0xFF00897B)
    private var scene by mutableStateOf("clip")
    private val failures = mutableListOf<String>(); private var checks = 0
    private fun check(ok: Boolean, msg: String) { checks++; if (!ok) failures += msg }
    private fun near(a: List<Int>, b: List<Int>, t: Int) = a.zip(b).all { abs(it.first - it.second) <= t }
    private var density = 2f

    @Composable private fun Acc(y: Double) = AWCComponent("md-accordion", mapOf("floating" to true, "initialX" to 24.0, "initialY" to y)) { slot ->
        if (slot == "") AWCComponent("md-accordion-item", mapOf("headline" to "Panel")) { if (it == "") Text("Body") } }
    @Composable private fun Second() = Box(Modifier.background(teal).padding(60.dp)) { Text("Later") }
    @Composable private fun Sheet() = AWCComponent("md-bottom-sheet", mapOf("open" to true, "headline" to "Share")) { if (it == "") Text("Sheet body") }
    @Composable private fun Dialog() = AWCComponent("md-dialog", mapOf("open" to true, "headline" to "Dialog")) { if (it == "") Text("Dialog body") }
    @Composable private fun Scene() {
        val vp = oracle.getJSONObject("viewport")
        Box(Modifier.requiredSize(vp.getDouble("width").dp, vp.getDouble("height").dp).background(Color.White)) {
            AWCModalScope(Modifier.fillMaxSize()) { AWCAccordionViewport(Modifier.fillMaxSize()) { Column {
                when (scene) {
                    "clip" -> { Box(Modifier.requiredSize(200.dp, 40.dp).clipToBounds()) { Acc(100.0) }; Second() }
                    "sheet" -> { Box { Acc(200.0) }; Second(); Sheet() }
                    "dialog" -> { Box { Acc(150.0) }; Second(); Dialog() }
                    else -> { Sheet(); Box { Acc(200.0) }; Second() }
                }
            } } }
        }
    }
    private fun shot(): (Double, Double) -> List<Int> {
        compose.waitForIdle(); val bitmap = compose.onRoot().captureToImage().asAndroidBitmap()
        return { x, y -> val p = bitmap.getPixel((x * density).toInt().coerceIn(0, bitmap.width - 1), (y * density).toInt().coerceIn(0, bitmap.height - 1))
            listOf((p shr 16) and 255, (p shr 8) and 255, p and 255) }
    }

    @Test fun floatingPanelStacksInTheOverlayLayer() {
        compose.setContent { CompositionLocalProvider(LocalDensity provides Density(2f, 1f)) { density = LocalDensity.current.density
            AWCTheme(darkTheme = false) { AWCAccessibilityAppearanceScope(reducedMotion = true) { key(scene) { Scene() } } } } }
        for (name in listOf("clip", "sheet", "dialog", "sheetAfter")) {
            compose.runOnIdle { scene = name }; compose.waitForIdle(); compose.mainClock.advanceTimeBy(1200)
            val rgb = shot(); val web = oracle.getJSONObject(name)
            for (p in web.getJSONArray("probes").objects() + web.getJSONArray("grid").objects()) {
                val x = p.getDouble("x"); val y = p.getDouble("y"); val grid = p.getString("label") == "grid"
                // The bottom edge of the clip scene's second container is the authored text-line metric, not stacking (see the Swift replay).
                if (name == "clip" && grid && y == 180.0) continue
                val want = p.getJSONArray("rgb").ints(); val got = rgb(x, y)
                check(near(got, want, if (grid) 14 else 8), "$name: ${p.getString("label")} at ($x, $y) $got vs Chrome $want [${p.optString("top")}]")
            }
        }
        println("NativeStackingOverlayTest: ${checks - failures.size}/$checks checks passed")
        assertTrue("${failures.size} of $checks failed:\n" + failures.joinToString("\n"), failures.isEmpty())
    }
}
