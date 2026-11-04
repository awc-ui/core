package dev.awc.playground.charts

import android.util.Log
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File

/**
 * Chart Kotlin ports on the device against the Mac Chrome 153 oracles (outputs/native-parity/<tag>/web-oracle-mac): chart
 * scenes (5 kinds, every paint subset), line/area/bar hover-keys-pointer replays, pie and sparkline state runs (plain +
 * reduced motion). Same checks as the JVM run, but with Android ICU formatting and
 * Paint text metrics. Full output per check: files/accordion/chart-<name>.txt (pulled by A-test.sh).
 */
@RunWith(AndroidJUnit4::class)
class NativeChartParityTest {
    private fun check(name: String, block: (String) -> Unit) {
        ChartTestEnv.out.setLength(0)
        try { block(ChartTestEnv.root.path) } catch (e: Throwable) { println("FAIL exception $e ${e.stackTrace.take(6).joinToString()}") }
        val text = ChartTestEnv.out.toString(); val lines = text.lines()
        val dir = File(InstrumentationRegistry.getInstrumentation().targetContext.getExternalFilesDir(null), "accordion").apply { mkdirs() }
        File(dir, "chart-$name.txt").writeText(text)
        val count = Regex("""(\d+)/(\d+)\s*$""")
        val summary = lines.filter { !it.startsWith(" ") && !it.startsWith("FAIL") && count.containsMatchIn(it) }
        val fails = lines.filter { it.startsWith("FAIL") || it.startsWith("missing") }
        summary.forEach { Log.i("AWCAccordion", "chart $name: $it") }
        lines.filter { it.startsWith("FAIL") || it.startsWith("missing") || it.startsWith("   ") }.take(40).forEach { Log.i("AWCAccordion", "chart $name: $it") }
        val incomplete = summary.mapNotNull { count.find(it) }.filter { it.groupValues[1] != it.groupValues[2] }
        assertTrue("$name:\n" + lines.filter { it.startsWith("FAIL") || it.startsWith("missing") || it.startsWith("   ") }.take(60).joinToString("\n"),
            summary.isNotEmpty() && fails.isEmpty() && incomplete.isEmpty())
    }

    @Test fun chartScenes() = check("scenes") { sceneMain(arrayOf(it, "line", "area", "bar", "pie", "sparkline")) }
    @Test fun chartInteraction() = check("interaction") { Interact.main(arrayOf(it, "line", "area", "bar")) }
    @Test fun pieStates() = check("pie-states") { d -> listOf("states", "states-reduced-motion").forEach { PieInteract.main(arrayOf("$d/md-pie-chart/$it.json")) } }
    @Test fun sparklineStates() = check("sparkline-states") { d -> listOf("states", "states-reduced-motion").forEach { SparkInteract.main(arrayOf("$d/md-sparkline/$it.json")) } }
}
