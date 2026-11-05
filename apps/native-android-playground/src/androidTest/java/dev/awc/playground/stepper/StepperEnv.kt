package dev.awc.playground.stepper

import androidx.test.platform.app.InstrumentationRegistry
import dev.awc.nativeui.stepper.StepperPaintMeasure
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.zip.GZIPInputStream

/**
 * On-device environment for the md-stepper oracle harness: the Chrome 153 oracle JSON and tokens.css unpacked from the
 * test APK's assets (`stepper/…`, gzip), the bundled Roboto measured with android.graphics.Paint, and the harness
 * `println` captured per check.
 */
object StepperEnv {
    private val instr get() = InstrumentationRegistry.getInstrumentation()
    val root: File by lazy { File(instr.targetContext.cacheDir, "stepper-oracle").also { unpack(it) } }
    private fun unpack(dir: File) {
        val assets = instr.context.assets
        fun walk(path: String) {
            val kids = assets.list(path) ?: emptyArray()
            if (kids.isNotEmpty()) { kids.forEach { walk("$path/$it") }; return }
            val dst = File(dir, path.removePrefix("stepper/").removeSuffix(".gz")); dst.parentFile?.mkdirs()
            assets.open(path).use { i -> (if (path.endsWith(".gz")) GZIPInputStream(i) else i).use { g -> dst.outputStream().use { g.copyTo(it) } } }
        }
        dir.deleteRecursively(); walk("stepper")
    }
    private val texts = HashMap<String, String>()
    fun text(name: String): String = texts.getOrPut(name) { File(root, name).readText() }
    val measure: StepperPaintMeasure by lazy {
        val r = instr.targetContext.resources
        StepperPaintMeasure(r.getFont(dev.awc.nativeui.R.font.awc_roboto_regular), r.getFont(dev.awc.nativeui.R.font.awc_roboto_medium), r.getFont(dev.awc.nativeui.R.font.awc_roboto_bold))
    }
    fun parse(text: String): Any? = convert(if (text.trimStart().startsWith("[")) JSONArray(text) else JSONObject(text))
    private fun convert(v: Any?): Any? = when (v) {
        null, JSONObject.NULL -> null
        is JSONObject -> LinkedHashMap<String, Any?>().also { m -> v.keys().forEach { k -> m[k] = convert(v.opt(k)) } }
        is JSONArray -> (0 until v.length()).map { convert(v.opt(it)) }
        else -> v
    }
    val out = StringBuilder()
}

// Same-package declarations shadow kotlin.io.println for the harness.
fun println(message: Any?) { StepperEnv.out.append(message).append('\n') }
fun println() { StepperEnv.out.append('\n') }
