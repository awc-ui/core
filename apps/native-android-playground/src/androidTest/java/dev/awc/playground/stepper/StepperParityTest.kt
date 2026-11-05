package dev.awc.playground.stepper

import android.util.Log
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File

/**
 * md-stepper / md-step against the Mac Chrome 153 oracles (outputs/native-parity/md-stepper/web-oracle, byte-identical gzip
 * assets under stepper/): paint (142 cases) and the state / motion replays (plain + reduced motion), with Android Paint
 * text metrics over the bundled Roboto. Full output per check: files/accordion/stepper-<name>.txt (pulled by A-test.sh).
 */
@RunWith(AndroidJUnit4::class)
class StepperParityTest {
    private fun check(name: String, block: (String) -> Unit) {
        StepperEnv.out.setLength(0)
        try { block(File(StepperEnv.root, "md-stepper/web-oracle").path) } catch (e: Throwable) { println("FAIL exception $e ${e.stackTrace.take(6).joinToString()}") }
        val text = StepperEnv.out.toString(); val lines = text.lines()
        val dir = File(InstrumentationRegistry.getInstrumentation().targetContext.getExternalFilesDir(null), "accordion").apply { mkdirs() }
        File(dir, "stepper-$name.txt").writeText(text)
        val count = Regex("""(\d+)/(\d+)\s*$""")
        val summary = lines.filter { !it.startsWith(" ") && !it.startsWith("FAIL") && count.containsMatchIn(it) }
        val fails = lines.filter { it.startsWith("FAIL") || it.startsWith("missing") }
        summary.forEach { Log.i("AWCAccordion", "stepper $name: $it") }
        lines.filter { it.startsWith("FAIL") || it.startsWith("missing") || it.startsWith("   ") }.take(40).forEach { Log.i("AWCAccordion", "stepper $name: $it") }
        val incomplete = summary.mapNotNull { count.find(it) }.filter { it.groupValues[1] != it.groupValues[2] }
        assertTrue("$name:\n" + lines.filter { it.startsWith("FAIL") || it.startsWith("missing") || it.startsWith("   ") }.take(60).joinToString("\n"),
            summary.isNotEmpty() && fails.isEmpty() && incomplete.isEmpty())
    }
    @Test fun stepperPaint() = check("paint") { StepperParity.run(it, paint = true, states = false) }
    @Test fun stepperStates() = check("states") { StepperParity.run(it, paint = false, states = true) }
}
