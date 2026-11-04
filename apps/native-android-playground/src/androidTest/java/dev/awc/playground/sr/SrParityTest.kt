package dev.awc.playground.sr

import android.util.Log
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File

/**
 * md-slider and md-rating against the Mac Chrome 153 oracles (outputs/native-parity/<tag>/web-oracle, byte-identical gzip
 * assets under sr/): paint, the state / motion replays (plain + reduced motion) and the lifecycle runs (runtime property
 * changes, form reset, focusRating(), touch), with Android Paint text metrics. Full output per check:
 * files/accordion/sr-<name>.txt (pulled by A-test.sh).
 */
@RunWith(AndroidJUnit4::class)
class SrParityTest {
    private fun check(name: String, block: (String) -> Unit) {
        SrEnv.out.setLength(0)
        try { block(SrEnv.root.path) } catch (e: Throwable) { println("FAIL exception $e ${e.stackTrace.take(6).joinToString()}") }
        val text = SrEnv.out.toString(); val lines = text.lines()
        val dir = File(InstrumentationRegistry.getInstrumentation().targetContext.getExternalFilesDir(null), "accordion").apply { mkdirs() }
        File(dir, "sr-$name.txt").writeText(text)
        val count = Regex("""(\d+)/(\d+)\s*$""")
        val summary = lines.filter { !it.startsWith(" ") && !it.startsWith("FAIL") && count.containsMatchIn(it) }
        val fails = lines.filter { it.startsWith("FAIL") || it.startsWith("missing") }
        summary.forEach { Log.i("AWCAccordion", "sr $name: $it") }
        lines.filter { it.startsWith("FAIL") || it.startsWith("missing") || it.startsWith("   ") }.take(40).forEach { Log.i("AWCAccordion", "sr $name: $it") }
        val incomplete = summary.mapNotNull { count.find(it) }.filter { it.groupValues[1] != it.groupValues[2] }
        assertTrue("$name:\n" + lines.filter { it.startsWith("FAIL") || it.startsWith("missing") || it.startsWith("   ") }.take(60).joinToString("\n"),
            summary.isNotEmpty() && fails.isEmpty() && incomplete.isEmpty())
    }
    private fun lifecycle(dir: String, tag: String) = File("$dir/$tag/web-oracle/lifecycle.json").let { if (it.exists()) listOf(it.path) else emptyList() }

    @Test fun sliderPaint() = check("slider-paint") { SliderPaintCheck.main(arrayOf("$it/md-slider/web-oracle/paint.json")) }
    @Test fun sliderStates() = check("slider-states") { SliderInteract.main(arrayOf("$it/md-slider/web-oracle/states.json", "$it/md-slider/web-oracle/states-reduced.json")) }
    @Test fun sliderLifecycle() = check("slider-lifecycle") { d -> val f = lifecycle(d, "md-slider"); if (f.isEmpty()) println("lifecycle.json absent 1/1") else SliderInteract.main(f.toTypedArray()) }
    @Test fun ratingPaint() = check("rating-paint") { RatingPaintCheck.main(arrayOf("$it/md-rating/web-oracle/paint.json")) }
    @Test fun ratingStates() = check("rating-states") { RatingInteract.main(arrayOf("$it/md-rating/web-oracle/states.json", "$it/md-rating/web-oracle/states-reduced.json")) }
    @Test fun ratingLifecycle() = check("rating-lifecycle") { d -> val f = lifecycle(d, "md-rating"); if (f.isEmpty()) println("lifecycle.json absent 1/1") else RatingInteract.main(f.toTypedArray()) }
}
