package dev.awc.playground.sr

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
import dev.awc.nativeui.AWCRatingController
import dev.awc.nativeui.AWCRatingControllerScope
import dev.awc.nativeui.AWCTheme
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import java.io.File

/**
 * md-slider and md-rating through AWCComponent's dispatch on the device: renders light / dark × LTR / RTL (PNG set in
 * files/accordion/sr-views, the set the SwiftUI views render), accessibility semantics (range info, state text,
 * SetProgress) and keyboard driving the Web event names; the lifecycle of the real composables: an uncontrolled change
 * outside a form stays put across recompositions, host property updates in place (value, min / max re-clamp, disabled,
 * range), focusRating() through AWCRatingController, remount re-reads the props and a disposed view emits nothing.
 */
@OptIn(ExperimentalTestApi::class)
class SrViewsTest {
    @get:Rule val compose = createComposeRule()
    private var case by mutableStateOf<Triple<String, String, Map<String, Any?>>?>(null)
    private var dark by mutableStateOf(false)
    private var rtl by mutableStateOf(false)
    private val ratingController = AWCRatingController()
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
                        if (c != null) key(c.first, dark, rtl) {
                            AWCRatingControllerScope(ratingController) { AWCComponent(c.second, c.third, onEvent = { n, v -> events += n to v }) }
                        }
                    }
                }
            }
        }
    }

    private val cases: List<Triple<String, String, Map<String, Any?>>> = listOf(
        Triple("slider-standard", "md-slider", mapOf("value" to 30.0, "sliderAriaLabel" to "Volume")),
        Triple("slider-centered-md", "md-slider", mapOf("value" to 70.0, "variant" to "centered", "size" to "md")),
        Triple("slider-range-lg-indicator", "md-slider", mapOf("range" to true, "valueStart" to 20.0, "valueEnd" to 70.0, "size" to "lg", "valueIndicator" to true)),
        Triple("slider-stops", "md-slider", mapOf("value" to 40.0, "step" to 10.0, "stops" to true)),
        Triple("slider-inset-xl", "md-slider", mapOf("value" to 65.0, "size" to "xl", "insetIcon" to true, "icon" to "light_mode")),
        Triple("slider-vertical-indicator", "md-slider", mapOf("value" to 40.0, "orientation" to "vertical", "valueIndicator" to true)),
        Triple("slider-disabled-range", "md-slider", mapOf("range" to true, "valueStart" to 20.0, "valueEnd" to 70.0, "disabled" to true)),
        Triple("rating-half-label", "md-rating", mapOf("value" to 2.5, "precision" to 0.5, "showValueLabel" to true, "size" to "lg")),
        Triple("rating-heart", "md-rating", mapOf("value" to 3.5, "precision" to 0.5, "icon" to "favorite", "size" to "lg")),
        Triple("rating-readonly", "md-rating", mapOf("value" to 3.0, "readonly" to true)),
        Triple("rating-disabled", "md-rating", mapOf("value" to 3.0, "disabled" to true)),
    )

    private fun show(c: Triple<String, String, Map<String, Any?>>?, dark: Boolean = false, rtl: Boolean = false, clear: Boolean = true) {
        this.dark = dark; this.rtl = rtl; if (clear) events.clear(); case = c
        compose.waitForIdle(); compose.mainClock.advanceTimeBy(1200); compose.waitForIdle()
    }
    /** The same element (same key) with new host properties: a property update in place. */
    private fun update(vararg changes: Pair<String, Any?>) { val c = case!!; case = Triple(c.first, c.second, c.third + changes); compose.waitForIdle(); compose.mainClock.advanceTimeBy(600); compose.waitForIdle() }
    private fun state(node: SemanticsNodeInteraction) = node.fetchSemanticsNode().config.getOrNull(SemanticsProperties.StateDescription) ?: ""
    private fun progress(node: SemanticsNodeInteraction) = node.fetchSemanticsNode().config.getOrNull(SemanticsProperties.ProgressBarRangeInfo)
    private fun slider(name: String = "Volume") = compose.onNode(hasContentDescription(name) and SemanticsMatcher.keyIsDefined(SemanticsProperties.ProgressBarRangeInfo))
    private fun rating() = compose.onNode(SemanticsMatcher.keyIsDefined(SemanticsProperties.ProgressBarRangeInfo))

    /** A disabled thumb stays a SeekBar (SetProgress defined, as Web keeps role=slider) marked disabled; SetProgress does nothing. */
    private fun checkDisabledSeekBars(what: String, count: Int = 1) {
        val nodes = compose.onAllNodes(SemanticsMatcher.keyIsDefined(SemanticsActions.SetProgress)).fetchSemanticsNodes()
        var results = emptyList<Boolean?>()
        compose.runOnUiThread { results = nodes.map { it.config[SemanticsActions.SetProgress].action?.invoke(1f) } }
        compose.waitForIdle()
        check(nodes.size == count && nodes.all { it.config.contains(SemanticsProperties.Disabled) } && results.all { it == false } && events.isEmpty(),
            "$what: ${nodes.size} SeekBars, disabled ${nodes.map { it.config.contains(SemanticsProperties.Disabled) }}, SetProgress $results, events ${events.map { it.first }}")
    }

    @Test fun viewsRenderWireAndLifecycle() {
        host()
        val dir = File(files, "sr-views").apply { mkdirs() }
        val manifest = StringBuilder()
        // 1. Renders: 11 cases × light/dark × LTR/RTL.
        for (c in cases) for ((d, r) in listOf(false to false, true to true, false to true, true to false)) {
            show(c, d, r)
            val mode = (if (d) "dark" else "light") + "-" + (if (r) "rtl" else "ltr")
            val bmp = compose.onNodeWithTag("host").captureToImage().asAndroidBitmap()
            File(dir, "${c.first}-$mode.png").outputStream().use { bmp.compress(Bitmap.CompressFormat.PNG, 100, it) }
            val colours = HashSet<Int>(); for (y in 0 until bmp.height step 2) for (x in 0 until bmp.width step 2) { colours += bmp.getPixel(x, y); if (colours.size > 8) break }
            manifest.append("${c.first}-$mode: ${bmp.width}x${bmp.height} colours>${colours.size}\n")
            check(bmp.width > 20 && bmp.height > 20 && colours.size > 2, "render ${c.first}-$mode blank (${bmp.width}x${bmp.height}, ${colours.size} colours)")
            check(events.isEmpty(), "render ${c.first}-$mode emitted ${events.map { it.first }}")
        }
        show(null)
        File(dir, "manifest.txt").writeText(manifest.toString())

        // 2. Slider: semantics, SetProgress → mdInput / mdChange, keyboard → mdInput / mdChange.
        show(cases[0])
        var range = progress(slider())
        check(range != null && range.current == 30f && range.range == 0f..100f, "slider range info $range")
        slider().performSemanticsAction(SemanticsActions.SetProgress) { it(31f) }; compose.waitForIdle()
        check(events.any { it.first == "mdInput" } && events.any { it.first == "mdChange" }, "slider SetProgress events ${events.map { it.first }}")
        check(state(slider()).isNotEmpty(), "slider state description empty")
        // An uncontrolled change outside a form stays put across recompositions (Stencil's watchers fire on prop changes only).
        compose.mainClock.advanceTimeBy(800); compose.waitForIdle()
        check(progress(slider())?.current == 31f, "slider value after SetProgress + recomposition ${progress(slider())?.current}")
        events.clear()
        slider().requestFocus(); slider().performKeyInput { pressKey(Key.DirectionRight) }; compose.waitForIdle()
        check(events.any { it.first == "mdInput" } && events.any { it.first == "mdChange" }, "slider key events ${events.map { it.first }}")
        compose.mainClock.advanceTimeBy(800); compose.waitForIdle()
        check(progress(slider())?.current == 32f, "slider value after ArrowRight ${progress(slider())?.current}")
        // Host updates in place: value (no events), min / max re-clamp (no events), disabled (no SetProgress), back.
        events.clear(); update("value" to 70.0)
        check(progress(slider())?.current == 70f && events.isEmpty(), "slider value update ${progress(slider())?.current} ${events.map { it.first }}")
        update("max" to 50.0)
        range = progress(slider())
        check(range?.current == 50f && range.range == 0f..50f && events.isEmpty(), "slider max re-clamp $range ${events.map { it.first }}")
        update("min" to 60.0, "max" to 100.0)
        check(progress(slider())?.current == 60f, "slider min re-clamp ${progress(slider())}")
        update("disabled" to true)
        // Disabling the focused slider blurs its input (Chrome's focus fixup fires blur → mdBlur, as lifecycle.json records).
        check(events.map { it.first } == listOf("mdBlur"), "disabling the focused slider emitted ${events.map { it.first }}")
        events.clear()
        checkDisabledSeekBars("disabled slider")
        update("disabled" to false, "range" to true, "valueStart" to 65.0, "valueEnd" to 90.0)
        check(compose.onAllNodes(SemanticsMatcher.keyIsDefined(SemanticsProperties.ProgressBarRangeInfo)).fetchSemanticsNodes().size == 2, "range update thumbs")
        check(events.isEmpty(), "slider host updates emitted ${events.map { it.first }}")
        // Remount re-reads the props; a disposed slider emits nothing.
        show(null); show(cases[0]); check(progress(slider())?.current == 30f, "slider remount ${progress(slider())?.current}")
        show(null); events.clear(); compose.mainClock.advanceTimeBy(1500); compose.waitForIdle()
        check(events.isEmpty(), "disposed slider emitted ${events.map { it.first }}")
        show(cases[6])   // disabled range: two disabled SeekBars
        checkDisabledSeekBars("disabled range", 2)

        // 3. Rating: SetProgress → mdChange; the value stays; updates; focusRating(); readonly exposes no action.
        show(cases[7])
        rating().performSemanticsAction(SemanticsActions.SetProgress) { it(4f) }; compose.waitForIdle()
        check(events.any { it.first == "mdChange" }, "rating SetProgress events ${events.map { it.first }}")
        compose.mainClock.advanceTimeBy(800); compose.waitForIdle()
        check(progress(rating())?.current == 4f, "rating value after SetProgress + recomposition ${progress(rating())?.current}")
        events.clear(); update("value" to 1.5)
        check(progress(rating())?.current == 1.5f && events.isEmpty(), "rating value update ${progress(rating())?.current} ${events.map { it.first }}")
        update("value" to 9.0)
        check(progress(rating())?.current == 5f, "rating value clamp ${progress(rating())?.current}")
        update("max" to 3.0)
        val rr = progress(rating())
        check(rr?.current == 3f && rr.range.endInclusive == 3f && events.isEmpty(), "rating max re-clamp $rr ${events.map { it.first }}")
        check(ratingController.isConnected, "rating controller not bound")
        compose.runOnUiThread { ratingController.focusRating() }; compose.waitForIdle()
        check(rating().fetchSemanticsNode().config.getOrNull(SemanticsProperties.Focused) == true, "focusRating() did not focus the rating")
        rating().performKeyInput { pressKey(Key.DirectionLeft) }; compose.waitForIdle()
        check(events.lastOrNull()?.first == "mdChange" && progress(rating())?.current == 2.5f, "rating key after focusRating ${events.map { it.first }} ${progress(rating())?.current}")
        show(cases[9])
        check(compose.onAllNodes(SemanticsMatcher.keyIsDefined(SemanticsActions.SetProgress)).fetchSemanticsNodes().isEmpty(), "readonly rating exposes SetProgress")
        show(null); events.clear(); compose.mainClock.advanceTimeBy(1500); compose.waitForIdle()
        check(events.isEmpty(), "disposed rating emitted ${events.map { it.first }}")
        check(!ratingController.isConnected, "rating controller still bound after dispose")

        val summary = "sr views: ${checks - failures.size}/$checks checks"
        Log.i("AWCAccordion", summary); failures.take(40).forEach { Log.i("AWCAccordion", "sr views: FAIL $it") }
        File(files, "sr-views.txt").writeText("$summary\n" + failures.joinToString("\n") + "\n" + manifest)
        assertTrue(failures.joinToString("\n"), failures.isEmpty())
    }
}
