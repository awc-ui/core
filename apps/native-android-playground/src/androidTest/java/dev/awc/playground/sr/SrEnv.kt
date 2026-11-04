package dev.awc.playground.sr

import androidx.test.platform.app.InstrumentationRegistry
import dev.awc.nativeui.slider.SrPaintMeasurer
import dev.awc.nativeui.slider.SrTextMeasurer
import java.io.File
import java.util.zip.GZIPInputStream

/**
 * On-device environment for the md-slider / md-rating oracle harnesses: the Chrome 153 oracle JSON
 * unpacked from the test APK's assets (`sr/…`, gzip), the Web stylesheets the theme tokens come from, the bundled
 * Roboto measured with android.graphics.Paint (instead of the JVM's AWT), Android ICU behind ChartIntl, and the
 * harness `println` captured per check.
 */
object SrEnv {
    private val instr get() = InstrumentationRegistry.getInstrumentation()
    val root: File by lazy { File(instr.targetContext.cacheDir, "sr-oracle").also { unpack(it) } }
    private fun unpack(dir: File) {
        val assets = instr.context.assets
        fun walk(path: String) {
            val kids = assets.list(path) ?: emptyArray()
            if (kids.isNotEmpty()) { kids.forEach { walk("$path/$it") }; return }
            val dst = File(dir, path.removePrefix("sr/").removeSuffix(".gz")); dst.parentFile?.mkdirs()
            assets.open(path).use { i -> (if (path.endsWith(".gz")) GZIPInputStream(i) else i).use { g -> dst.outputStream().use { g.copyTo(it) } } }
        }
        dir.deleteRecursively(); walk("sr")
    }
    private val texts = HashMap<String, String>()
    fun text(name: String): String = texts.getOrPut(name) { File(root, name).readText() }
    val measurer: SrTextMeasurer by lazy {
        val r = instr.targetContext.resources
        SrPaintMeasurer(r.getFont(dev.awc.nativeui.R.font.awc_roboto_regular), r.getFont(dev.awc.nativeui.R.font.awc_roboto_medium), r.getFont(dev.awc.nativeui.R.font.awc_roboto_bold))
    }
    val out = StringBuilder()
}

/** The harnesses' text measurer: the device's Paint over the bundled Roboto. */
class ApproxMeasurer : SrTextMeasurer by SrEnv.measurer

// Same-package declarations shadow kotlin.io.println for the generated harness files.
fun println(message: Any?) { SrEnv.out.append(message).append('\n') }
fun println() { SrEnv.out.append('\n') }
