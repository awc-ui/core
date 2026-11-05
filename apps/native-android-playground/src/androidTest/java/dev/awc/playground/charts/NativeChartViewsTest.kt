package dev.awc.playground.charts

import android.graphics.Bitmap
import android.util.Log
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.test.platform.app.InstrumentationRegistry
import dev.awc.nativeui.AWCComponent
import dev.awc.nativeui.AWCTheme
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import androidx.compose.ui.state.ToggleableState
import java.io.File

/**
 * The dedicated Compose chart views through AWCComponent's dispatch on the device: the five charts and the header / footer
 * and donut-centre slots rendered light / dark × LTR / RTL (28 PNGs in files/accordion/chart-views — the set the SwiftUI
 * NativeChartViewsSmoke renders), then wiring checks: focus, keyboard driving the controllers to the Web event names
 * (mdHover / mdLegendClick), the legend chip state, the live announcement, and the
 * lifecycle (remount re-emits mdReady; a disposed chart emits nothing more).
 */
@OptIn(ExperimentalTestApi::class)
class NativeChartViewsTest {
    @get:Rule val compose = createComposeRule()
    private var case by mutableStateOf<Triple<String, String, Map<String, Any?>>?>(null)
    private var dark by mutableStateOf(false)
    private var rtl by mutableStateOf(false)
    private var slotText by mutableStateOf<Map<String, String>>(emptyMap())
    private val events = mutableListOf<Pair<String, Any?>>()
    private val failures = mutableListOf<String>()
    private var checks = 0
    private fun check(ok: Boolean, label: String) { checks++; if (!ok) failures += label }
    private val files = File(InstrumentationRegistry.getInstrumentation().targetContext.getExternalFilesDir(null), "accordion").apply { mkdirs() }

    private fun host() = compose.setContent {
        CompositionLocalProvider(LocalDensity provides Density(2f, 1f)) {
            AWCTheme(dark) {
                CompositionLocalProvider(LocalLayoutDirection provides if (rtl) LayoutDirection.Rtl else LayoutDirection.Ltr) {
                    Box(Modifier.testTag("host").background(if (dark) Color(0xFF1C1B1F) else Color(0xFFFFFBFE)).padding(8.dp).width(480.dp)) {
                        val c = case
                        val st = slotText
                        if (c != null) key(c.first, dark, rtl) {
                            if (st.isEmpty()) AWCComponent(c.second, c.third, onEvent = { n, v -> events += n to v })
                            else AWCComponent(c.second, c.third, onEvent = { n, v -> events += n to v }) { slot -> st[slot]?.let { androidx.compose.material3.Text(it) } }
                        }
                    }
                }
            }
        }
    }

    private val series = listOf(mapOf("label" to "Revenue", "data" to listOf(12.0, 18.0, 15.0, 22.0, 28.0, 26.0)), mapOf("label" to "Cost", "data" to listOf(8.0, 11.0, 10.0, 14.0, 16.0, 18.0)))
    private val xAxis = mapOf("data" to listOf("Jan", "Feb", "Mar", "Apr", "May", "Jun"))
    private val cases: List<Triple<String, String, Map<String, Any?>>> = listOf(
        Triple("chart-line", "md-line-chart", mapOf("series" to series, "xAxis" to xAxis, "label" to "Line", "height" to "260px", "noAnimation" to true)),
        Triple("chart-area", "md-area-chart", mapOf("series" to series, "xAxis" to xAxis, "label" to "Area", "height" to "260px", "noAnimation" to true)),
        Triple("chart-bar", "md-bar-chart", mapOf("series" to series, "xAxis" to xAxis, "label" to "Bar", "height" to "260px", "noAnimation" to true)),
        Triple("chart-pie", "md-pie-chart", mapOf("data" to listOf("A" to 40.0, "B" to 25.0, "C" to 20.0, "D" to 15.0).map { mapOf("label" to it.first, "value" to it.second) }, "label" to "Pie", "height" to "260px", "noAnimation" to true)),
        Triple("chart-sparkline", "md-sparkline", mapOf("data" to listOf(3.0, 5.0, 4.0, 7.0, 6.0, 9.0, 8.0), "height" to "32px", "noAnimation" to true)),
    )

    private fun show(c: Triple<String, String, Map<String, Any?>>?, dark: Boolean = false, rtl: Boolean = false, slots: Map<String, String> = emptyMap()) {
        this.dark = dark; this.rtl = rtl; events.clear(); slotText = slots; case = c
        compose.waitForIdle(); compose.mainClock.advanceTimeBy(1200); compose.waitForIdle()
    }

    private fun plot() = compose.onNode(hasContentDescription("Chart data", substring = true))
    private val debug = StringBuilder()
    private fun snap(label: String) {
        debug.append("== $label  events=${events.map { it.first }}\n").append(compose.onRoot(useUnmergedTree = false).printToString(maxDepth = 12)).append("\n")
        val bmp = compose.onNodeWithTag("host").captureToImage().asAndroidBitmap()
        File(File(files, "chart-views").apply { mkdirs() }, "debug-$label.png").outputStream().use { bmp.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }
    private fun state(node: SemanticsNodeInteraction) = node.fetchSemanticsNode().config.getOrNull(SemanticsProperties.StateDescription) ?: ""

    @Test fun viewsRenderAndWire() {
        host()
        val dir = File(files, "chart-views").apply { mkdirs() }
        val manifest = StringBuilder()
        // 1. Renders: 5 cases × light/dark × LTR/RTL.
        for (c in cases) for ((d, r) in listOf(false to false, true to true, false to true, true to false)) {
            show(c, d, r)
            val mode = (if (d) "dark" else "light") + "-" + (if (r) "rtl" else "ltr")
            val img = compose.onNodeWithTag("host").captureToImage()
            val bmp = img.asAndroidBitmap()
            File(dir, "${c.first}-$mode.png").outputStream().use { bmp.compress(Bitmap.CompressFormat.PNG, 100, it) }
            val colours = HashSet<Int>(); for (y in 0 until bmp.height step 2) for (x in 0 until bmp.width step 2) { colours += bmp.getPixel(x, y); if (colours.size > 8) break }
            manifest.append("${c.first}-$mode: ${bmp.width}x${bmp.height} colours>${colours.size}\n")
            check(bmp.width > 20 && bmp.height > 20 && colours.size > 2, "render ${c.first}-$mode blank (${bmp.width}x${bmp.height}, ${colours.size} colours)")
            if (c.second != "md-sparkline")
                check(events.any { it.first == "mdReady" }, "render ${c.first}-$mode: no mdReady")
        }
        // Slots: header + footer (in flow at the top, under the canvas) and the donut centre (on the ring centre).
        val slotCases = listOf(Triple(Triple("chart-line-slots", "md-line-chart", cases[0].third), mapOf("header" to "Quarterly revenue", "footer" to "Source: finance"), "Source: finance"),
            Triple(Triple("chart-pie-center", "md-pie-chart", cases[3].third + ("innerRadius" to "55%")), mapOf("center" to "100%"), "100%"))
        for ((c, slots, probe) in slotCases) for ((d, r) in listOf(false to false, true to true, false to true, true to false)) {
            show(c, d, r, slots)
            val mode = (if (d) "dark" else "light") + "-" + (if (r) "rtl" else "ltr")
            val bmp = compose.onNodeWithTag("host").captureToImage().asAndroidBitmap()
            File(dir, "${c.first}-$mode.png").outputStream().use { bmp.compress(Bitmap.CompressFormat.PNG, 100, it) }
            val node = compose.onAllNodes(hasText(probe)).fetchSemanticsNodes()
            check(node.size == 1, "${c.first}-$mode: slot text '$probe' found ${node.size}x")
            manifest.append("${c.first}-$mode: ${bmp.width}x${bmp.height} slot ${node.firstOrNull()?.boundsInRoot}\n")
        }
        show(null)
        File(dir, "manifest.txt").writeText(manifest.toString())

        // 2. Charts: keyboard hover + announcement; legend chip toggles.
        for (i in 0..2) {
            show(cases[i])
            val p = plot()
            p.requestFocus(); compose.waitForIdle()
            check(p.fetchSemanticsNode().config.getOrNull(SemanticsProperties.Focused) == true, "${cases[i].first} plot not focused")
            p.performKeyInput { pressKey(Key.DirectionRight) }; compose.waitForIdle()
            snap("${cases[i].first}-key")
            // Chrome (keys.json): md-line-chart emits mdHover for keyboard moves; md-area-chart and md-bar-chart emit none.
            check(events.any { it.first == "mdHover" } == (i == 0), "${cases[i].first} key hover events ${events.map { it.first }}")
            check(state(p).isNotEmpty(), "${cases[i].first} announcement empty")
            events.clear()
            compose.onNode(hasContentDescription("Cost") and hasClickAction()).performSemanticsAction(SemanticsActions.OnClick); compose.waitForIdle()
            snap("${cases[i].first}-legend")
            check(events.any { it.first == "mdLegendClick" }, "${cases[i].first} legend click events ${events.map { it.first }}")
            check(compose.onNode(hasContentDescription("Cost") and hasClickAction()).fetchSemanticsNode().config.getOrNull(SemanticsProperties.ToggleableState) == ToggleableState.Off, "${cases[i].first} legend chip not off")
        }
        show(cases[0])
        val chips = compose.onAllNodes(hasClickAction() and SemanticsMatcher.keyIsDefined(SemanticsProperties.ToggleableState)).fetchSemanticsNodes()
        check(chips.size == 2 && chips.all { it.config.getOrNull(SemanticsProperties.ToggleableState) == ToggleableState.On && it.config.getOrNull(SemanticsProperties.Role) == Role.Button },
            "legend chips are pressed toggle buttons (${chips.map { it.config }})")
        check(chips.all { it.config.getOrNull(SemanticsProperties.ContentDescription)?.size == 1 && it.config.getOrNull(SemanticsProperties.Text) == null && it.children.isEmpty() }, "legend chip label exposed once")
        val actions = plot().fetchSemanticsNode().config.getOrNull(SemanticsActions.CustomActions)?.map { it.label }
        check(actions == listOf("Next point", "Previous point", "First point", "Last point"), "plot step actions $actions")
        val next = plot().fetchSemanticsNode().config[SemanticsActions.CustomActions][0]
        events.clear(); compose.runOnUiThread { next.action() }; compose.waitForIdle()
        check(state(plot()).isNotEmpty() && compose.onAllNodes(SemanticsMatcher.expectValue(SemanticsProperties.LiveRegion, LiveRegionMode.Polite)).fetchSemanticsNodes().size == 1, "Next point moves the cursor; one polite live region")
        // Tab order as on the Web: the plot, then the legend toggle buttons (the plot's siblings: a key on a focused chip stays
        // with the chip); Enter / Space toggle the focused chip.
        val first = series.first()["label"] as String
        val chip = { compose.onNode(hasContentDescription(first) and hasClickAction()) }
        plot().requestFocus(); compose.waitForIdle()
        plot().performKeyInput { pressKey(Key.Tab) }; compose.waitForIdle()
        check(chip().fetchSemanticsNode().config.getOrNull(SemanticsProperties.Focused) == true && plot().fetchSemanticsNode().config.getOrNull(SemanticsProperties.Focused) != true,
            "Tab from the plot reaches the first legend chip")
        val before = state(plot())
        chip().performKeyInput { pressKey(Key.DirectionRight) }; compose.waitForIdle()
        check(state(plot()) == before, "an arrow key on a focused chip leaves the chart cursor alone")
        // (Android moves focus between the chips with the arrow keys, as D-pad navigation does; back to the first chip.)
        chip().requestFocus(); compose.waitForIdle()
        chip().performKeyInput { pressKey(Key.Enter) }; compose.waitForIdle()
        check(chip().fetchSemanticsNode().config.getOrNull(SemanticsProperties.ToggleableState) == ToggleableState.Off, "Enter toggles the focused chip")
        chip().performKeyInput { pressKey(Key.Spacebar) }; compose.waitForIdle()
        check(chip().fetchSemanticsNode().config.getOrNull(SemanticsProperties.ToggleableState) == ToggleableState.On, "Space toggles the focused chip")
        show(cases[4])
        check(compose.onAllNodes(SemanticsMatcher.expectValue(SemanticsProperties.Role, Role.Image)).fetchSemanticsNodes().size == 1, "sparkline is an image")
        show(cases[3])
        val pie = plot(); pie.requestFocus(); compose.waitForIdle()
        check(pie.fetchSemanticsNode().config.getOrNull(SemanticsProperties.Focused) == true, "pie plot not focused")
        pie.performKeyInput { pressKey(Key.DirectionRight) }; compose.waitForIdle()
        check(state(pie).isNotEmpty(), "pie key focus announcement empty ${events.map { it.first }}")

        // 3. Lifecycle: remount re-emits mdReady; after dispose nothing is emitted.
        show(cases[0]); val ready1 = events.count { it.first == "mdReady" }
        show(null); events.clear(); compose.mainClock.advanceTimeBy(2000); compose.waitForIdle()
        check(events.isEmpty(), "disposed chart emitted ${events.map { it.first }}")
        show(cases[0]); check(ready1 == 1 && events.count { it.first == "mdReady" } == 1, "remount mdReady $ready1 / ${events.count { it.first == "mdReady" }}")

        val summary = "chart views: ${checks - failures.size}/$checks checks"
        Log.i("AWCAccordion", summary); failures.take(40).forEach { Log.i("AWCAccordion", "chart views: FAIL $it") }
        File(files, "chart-views.txt").writeText("$summary\n" + failures.joinToString("\n") + "\n" + manifest + "\n" + debug)
        assertTrue(failures.joinToString("\n"), failures.isEmpty())
    }
}
